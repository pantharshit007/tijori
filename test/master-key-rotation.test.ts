import { describe, expect, it } from "bun:test";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import { decrypt, deriveKey, encrypt, generateSalt, hash } from "../src/lib/crypto";

const modules = {
  "../convex/_generated/server.ts": () => import("../convex/_generated/server"),
  "../convex/projects.ts": () => import("../convex/projects"),
  "../convex/users.ts": () => import("../convex/users"),
};

async function fixture(count = 2) {
  const t = convexTest(schema, modules);
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", {
      tokenIdentifier: "owner",
      name: "Owner",
      email: "owner@example.test",
      tier: "pro",
      masterKeyHash: "old-hash",
      masterKeySalt: "old-salt",
    })
  );
  const owner = t.withIdentity({ tokenIdentifier: "owner" });
  for (let i = 0; i < count; i++) {
    await owner.mutation(api.projects.create, {
      expectedMasterKeyRevision: 0,
      name: `Project ${i}`,
      passcodeHash: "passcode-hash",
      encryptedPasscode: "old-ciphertext",
      passcodeSalt: "project-salt",
      iv: "old-iv",
      authTag: "old-tag",
    });
  }
  const snapshot = await owner.query(api.projects.rotationSnapshot, {});
  const args = {
    expectedMasterKeyRevision: snapshot.masterKeyRevision,
    newMasterKeyHash: "new-hash",
    newMasterKeySalt: "new-salt",
    updates: snapshot.projects.map((p) => ({
      projectId: p._id,
      passcodeSalt: p.passcodeSalt,
      expectedRecovery: { encryptedPasscode: p.encryptedPasscode, iv: p.iv, authTag: p.authTag },
      encryptedPasscode: "new-ciphertext",
      iv: "new-iv",
      authTag: "new-tag",
    })),
  };
  const state = () =>
    t.run(async (ctx) => ({
      user: await ctx.db.get(userId),
      projects: await ctx.db.query("projects").collect(),
    }));
  return { t, owner, userId, args, state };
}

describe("atomic master key rotation", () => {
  for (const invalid of [
    "empty",
    "incomplete",
    "duplicate",
    "salt",
    "ciphertext",
    "iv",
    "tag",
    "revision",
    "foreign",
  ] as const) {
    it(`rejects ${invalid} submissions without changing any stored data`, async () => {
      const f = await fixture();
      if (invalid === "foreign") {
        const foreignId = await f.t.run(async (ctx) => {
          const userId = await ctx.db.insert("users", {
            tokenIdentifier: "other",
            name: "Other",
            email: "other@example.test",
            tier: "free",
          });
          const project = (await ctx.db.get(f.args.updates[0].projectId))!;
          const { _id, _creationTime, ...fields } = project;
          return ctx.db.insert("projects", { ...fields, ownerId: userId });
        });
        f.args.updates[0].projectId = foreignId;
      }
      if (invalid === "empty") f.args.updates = [];
      if (invalid === "incomplete") f.args.updates.pop();
      if (invalid === "duplicate") f.args.updates[1] = f.args.updates[0];
      if (invalid === "salt") f.args.updates[0].passcodeSalt = "changed";
      if (invalid === "ciphertext") f.args.updates[0].expectedRecovery.encryptedPasscode = "stale";
      if (invalid === "iv") f.args.updates[0].expectedRecovery.iv = "stale";
      if (invalid === "tag") f.args.updates[0].expectedRecovery.authTag = "stale";
      if (invalid === "revision") f.args.expectedMasterKeyRevision = 1;
      const before = await f.state();
      await expect(f.owner.mutation(api.projects.batchUpdatePasscodes, f.args)).rejects.toThrow();
      expect(await f.state()).toEqual(before);
    });
  }

  it("rejects a rotation if creation committed after its snapshot", async () => {
    const f = await fixture(0);
    await f.owner.mutation(api.projects.create, {
      expectedMasterKeyRevision: 0,
      name: "Late",
      passcodeHash: "hash",
      encryptedPasscode: "ciphertext",
      passcodeSalt: "salt",
      iv: "iv",
      authTag: "tag",
    });
    const before = await f.state();
    await expect(f.owner.mutation(api.projects.batchUpdatePasscodes, f.args)).rejects.toThrow();
    expect(await f.state()).toEqual(before);
  });

  it("allows only one of two simultaneous rotations from the same snapshot", async () => {
    const f = await fixture();
    const results = await Promise.allSettled([
      f.owner.mutation(api.projects.batchUpdatePasscodes, f.args),
      f.owner.mutation(api.projects.batchUpdatePasscodes, {
        ...f.args,
        newMasterKeyHash: "competing-hash",
      }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect((await f.state()).user?.masterKeyRevision).toBe(1);
  });

  it("rejects stale creation and a competing rotation after rotation commits", async () => {
    const f = await fixture();
    await f.owner.mutation(api.projects.batchUpdatePasscodes, f.args);
    const before = await f.state();
    await expect(f.owner.mutation(api.projects.batchUpdatePasscodes, f.args)).rejects.toThrow();
    await expect(
      f.owner.mutation(api.projects.create, {
        expectedMasterKeyRevision: 0,
        name: "Stale",
        passcodeHash: "hash",
        encryptedPasscode: "ciphertext",
        passcodeSalt: "salt",
        iv: "iv",
        authTag: "tag",
      })
    ).rejects.toThrow();
    expect(await f.state()).toEqual(before);
  });

  it("rejects deleted projects and blocked or unauthenticated callers", async () => {
    const f = await fixture();
    await expect(f.t.mutation(api.projects.batchUpdatePasscodes, f.args)).rejects.toThrow();
    await f.t.run((ctx) => ctx.db.patch(f.userId, { isDeactivated: true }));
    await expect(f.owner.query(api.projects.rotationSnapshot, {})).rejects.toThrow();
    await expect(f.owner.mutation(api.projects.batchUpdatePasscodes, f.args)).rejects.toThrow();
    await f.t.run(async (ctx) => {
      await ctx.db.patch(f.userId, { isDeactivated: false });
      await ctx.db.delete(f.args.updates[0].projectId);
    });
    const before = await f.state();
    await expect(f.owner.mutation(api.projects.batchUpdatePasscodes, f.args)).rejects.toThrow();
    expect(await f.state()).toEqual(before);
  });

  it("allows only initial setup and uses revisioned rotation even without projects", async () => {
    const f = await fixture(0);
    await expect(
      f.owner.mutation(api.users.setMasterKey, {
        masterKeyHash: "replace",
        masterKeySalt: "replace",
      })
    ).rejects.toThrow();
    await f.owner.mutation(api.projects.batchUpdatePasscodes, f.args);
    expect((await f.state()).user?.masterKeyRevision).toBe(1);
    await f.t.run((ctx) =>
      ctx.db.patch(f.userId, {
        masterKeyHash: undefined,
        masterKeySalt: undefined,
        masterKeyRevision: undefined,
      })
    );
    await f.owner.mutation(api.users.setMasterKey, {
      masterKeyHash: "initial",
      masterKeySalt: "initial",
    });
    await expect(
      f.owner.mutation(api.users.setMasterKey, { masterKeyHash: "again", masterKeySalt: "again" })
    ).rejects.toThrow();
  });

  it("rejects initial setup when an unconfigured user owns projects", async () => {
    const f = await fixture();
    await f.t.run((ctx) =>
      ctx.db.patch(f.userId, { masterKeyHash: undefined, masterKeySalt: undefined })
    );
    const before = await f.state();
    await expect(
      f.owner.mutation(api.users.setMasterKey, {
        masterKeyHash: "replace",
        masterKeySalt: "replace",
      })
    ).rejects.toThrow();
    expect(await f.state()).toEqual(before);
  });

  it("preserves recovery, passcode verification, and variable decryption for every project", async () => {
    const f = await fixture();
    const oldMaster = "old master secret";
    const newMaster = "new master secret";
    const variables = [];
    for (const update of f.args.updates) {
      const salt = generateSalt();
      const passcode = "123456";
      const recovery = await encrypt(passcode, await deriveKey(oldMaster, salt));
      const variable = await encrypt("secret variable", await deriveKey(passcode, salt));
      variables.push(variable);
      const passcodeHash = await hash(passcode, salt);
      await f.t.run((ctx) =>
        ctx.db.patch(update.projectId, {
          passcodeSalt: salt,
          passcodeHash,
        })
      );
      update.passcodeSalt = salt;
      update.expectedRecovery = {
        encryptedPasscode: recovery.encryptedValue,
        iv: recovery.iv,
        authTag: recovery.authTag,
      };
      await f.t.run((ctx) => ctx.db.patch(update.projectId, update.expectedRecovery));
      const recovered = await decrypt(
        recovery.encryptedValue,
        recovery.iv,
        recovery.authTag,
        await deriveKey(oldMaster, salt)
      );
      const rewrapped = await encrypt(recovered, await deriveKey(newMaster, salt));
      update.encryptedPasscode = rewrapped.encryptedValue;
      update.iv = rewrapped.iv;
      update.authTag = rewrapped.authTag;
    }
    const before = await f.state();
    await f.owner.mutation(api.projects.batchUpdatePasscodes, f.args);
    const after = await f.state();
    for (const [i, project] of after.projects.entries()) {
      expect(project.passcodeSalt).toBe(before.projects[i].passcodeSalt);
      expect(project.passcodeHash).toBe(before.projects[i].passcodeHash);
      const passcode = await decrypt(
        project.encryptedPasscode,
        project.iv,
        project.authTag,
        await deriveKey(newMaster, project.passcodeSalt)
      );
      expect(passcode).toBe("123456");
      expect(await hash(passcode, project.passcodeSalt)).toBe(project.passcodeHash);
      const v = variables[i];
      expect(
        await decrypt(
          v.encryptedValue,
          v.iv,
          v.authTag,
          await deriveKey(passcode, project.passcodeSalt)
        )
      ).toBe("secret variable");
    }
  });
});

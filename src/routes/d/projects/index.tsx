import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, Construction, FolderKanban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/d/projects/")({
  component: function ProjectsIndex() {
    return (
      <div className="max-w-4xl mx-auto space-y-8 py-10 px-4">
        <div className="flex items-center gap-4">
          <Link to="/d/dashboard">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">All Projects</h1>
            <p className="text-muted-foreground">
              Manage and organize all your secure projects
            </p>
          </div>
        </div>

        <Card className="border-dashed border-2 bg-accent/5">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Construction className="h-8 w-8 text-primary animate-pulse" />
            </div>
            <CardTitle className="text-2xl">Coming Soon</CardTitle>
            <CardDescription className="text-base max-w-md mx-auto">
              We're currently building an advanced project management view. 
              This will feature custom folders, advanced filtering, and bulk operations.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-10 space-y-6">
            <div className="text-sm text-center text-muted-foreground bg-accent/20 px-4 py-2 rounded-full border">
               For now, you can access and manage all your projects from the <Link to="/d/dashboard" className="text-primary font-medium hover:underline">Dashboard</Link>.
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-lg">
               <div className="p-4 rounded-lg border bg-card/50 flex items-center gap-3 grayscale opacity-60">
                 <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center">
                   <FolderKanban className="h-5 w-5" />
                 </div>
                 <div className="space-y-1">
                   <div className="h-3 w-24 bg-muted rounded"></div>
                   <div className="h-2 w-32 bg-muted/60 rounded"></div>
                 </div>
               </div>
               <div className="p-4 rounded-lg border bg-card/50 flex items-center gap-3 grayscale opacity-60">
                 <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center">
                   <FolderKanban className="h-5 w-5" />
                 </div>
                 <div className="space-y-1">
                   <div className="h-3 w-20 bg-muted rounded"></div>
                   <div className="h-2 w-28 bg-muted/60 rounded"></div>
                 </div>
               </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-center">
          <Link to="/d/dashboard">
            <Button variant="default" className="px-8">
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  },
});

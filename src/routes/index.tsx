import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { ArrowRight, Clock, FolderKey, Plus } from 'lucide-react'
import { api } from '../../convex/_generated/api'


import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatRelativeTime } from '@/lib/time'

function Dashboard() {
  const projects = useQuery(api.projects.list)

  // Sort projects by updatedAt
  const sortedProjects = projects
    ?.sort((a, b) => b.updatedAt - a.updatedAt)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Manage your secure project environment variables.
          </p>
        </div>
        <Link to="/projects/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Project
          </Button>
        </Link>
      </div>

      {/* Projects Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold tracking-tight">Your Projects</h2>
          {projects && projects.length > 5 && (
            <Link to="/projects" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
              View all {projects.length}
              <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>

        {projects === undefined ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-48 mt-2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-24" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : projects.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FolderKey className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No projects yet</h3>
              <p className="text-muted-foreground text-center mb-4">
                Create your first project to start managing environment variables
                securely.
              </p>
              <Link to="/projects/new">
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create Project
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sortedProjects?.map((project) => (
              <Link
                key={project._id}
                to="/projects/$projectId"
                params={{ projectId: project._id }}
              >
                <Card className="hover:bg-accent/50 transition-colors cursor-pointer h-full">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                        <FolderKey className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-lg truncate">{project.name}</CardTitle>
                        <CardDescription className="text-xs">
                          {project.role}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {project.description || 'No description provided.'}
                    </p>
                    <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>Updated {formatRelativeTime(project.updatedAt)}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export const Route = createFileRoute('/')({
  component: Dashboard,
})


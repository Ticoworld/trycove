import {and,eq,notExists,desc} from 'drizzle-orm';
import {alias} from 'drizzle-orm/pg-core';
import {db} from './db';
import {projectDeclarations,projects} from './schema';

export function declarations(projectId?: string, testingOnly = false) {
  const newer = alias(projectDeclarations, 'newer_declaration');
  return db.select({id: projectDeclarations.id, projectId: projects.id, product: projects.name,
    kind: projectDeclarations.kind, content: projectDeclarations.content, prerequisites: projectDeclarations.prerequisites})
    .from(projectDeclarations).innerJoin(projects,eq(projects.id,projectDeclarations.projectId))
    .where(and(projectId ? eq(projects.id,projectId) : undefined,
      testingOnly ? eq(projectDeclarations.kind,'testing-need') : undefined,
      eq(projectDeclarations.state,'published'),eq(projectDeclarations.moderation,'visible'),
      notExists(db.select({id:newer.id}).from(newer).where(eq(newer.supersedesId,projectDeclarations.id)))))
    .orderBy(desc(projectDeclarations.createdAt)).limit(100);
}

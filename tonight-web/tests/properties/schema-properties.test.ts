import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const migrationSql = readFileSync(
  path.resolve(process.cwd(), 'prisma/migrations/0001_init/migration.sql'),
  'utf-8'
);

const schemaSource = readFileSync(
  path.resolve(process.cwd(), 'prisma/schema.prisma'),
  'utf-8'
);

describe('Property 36: Referential Integrity Enforcement', () => {
  const foreignKeys = [
    { constraint: '"Event_hostId_fkey"', reference: 'REFERENCES "User"("id")' },
    { constraint: '"JoinRequest_eventId_fkey"', reference: 'REFERENCES "Event"("id")' },
    { constraint: '"JoinRequest_userId_fkey"', reference: 'REFERENCES "User"("id")' },
    { constraint: '"Message_joinRequestId_fkey"', reference: 'REFERENCES "JoinRequest"("id")' },
    { constraint: '"Message_senderId_fkey"', reference: 'REFERENCES "User"("id")' },
    { constraint: '"BlockedUser_blockerId_fkey"', reference: 'REFERENCES "User"("id")' },
    { constraint: '"BlockedUser_blockedId_fkey"', reference: 'REFERENCES "User"("id")' },
    { constraint: '"Report_reporterId_fkey"', reference: 'REFERENCES "User"("id")' },
    { constraint: '"Report_reportedUserId_fkey"', reference: 'REFERENCES "User"("id")' },
    { constraint: '"Report_eventId_fkey"', reference: 'REFERENCES "Event"("id")' },
    { constraint: '"MagicLink_userId_fkey"', reference: 'REFERENCES "User"("id")' },
  ];

  it('ensures every declared foreign key is present in the migration SQL', () => {
    fc.assert(
      fc.property(fc.constantFrom(...foreignKeys), (fk) => {
        expect(migrationSql).toContain(`CONSTRAINT ${fk.constraint}`);
        expect(migrationSql).toContain(fk.reference);
      })
    );
  });
});

describe('Property 37: Automatic Timestamp Management', () => {
  const createdAtTables = ['User', 'Event', 'JoinRequest', 'Message', 'BlockedUser', 'Report', 'MagicLink'];
  it('ensures every table has a createdAt defaulting to CURRENT_TIMESTAMP', () => {
    fc.assert(
      fc.property(fc.constantFrom(...createdAtTables), (tableName) => {
        const regex = new RegExp(
          `CREATE TABLE \"${tableName}\"[\\s\\S]*?\"createdAt\"[^,]+DEFAULT CURRENT_TIMESTAMP`,
          'm'
        );
        expect(regex.test(migrationSql)).toBe(true);
      })
    );
  });

  const updatedAtModels = ['User', 'Event', 'JoinRequest'];
  it('ensures updatedAt fields are annotated with @updatedAt in the Prisma schema', () => {
    fc.assert(
      fc.property(fc.constantFrom(...updatedAtModels), (modelName) => {
        const regex = new RegExp(
          `model\\s+${modelName}[\\s\\S]*?updatedAt\\s+DateTime[^{]*@updatedAt`,
          'm'
        );
        expect(regex.test(schemaSource)).toBe(true);
      })
    );
  });
});

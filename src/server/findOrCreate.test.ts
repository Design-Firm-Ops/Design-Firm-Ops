import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prismaMock } from '@/test/prisma';
import { findOrCreateProjectType } from '@/server/projectType';
import { findOrCreateRoom } from '@/server/room';
import { findOrCreateFeeStructureOption } from '@/server/feeStructure';

vi.mock('@/server/prisma', () => ({ prisma: prismaMock }));

// These grow user-editable taxonomies as people type new values. The shared
// contract: blank input is a no-op, whitespace is trimmed, and an existing
// row is reused rather than duplicated.

beforeEach(() => {
  prismaMock.reset();
});

describe('findOrCreateProjectType', () => {
  it('returns the existing row without creating a duplicate', async () => {
    prismaMock.projectType.findUnique.mockResolvedValue({ id: 'pt-1', name: 'Residential' });
    expect(await findOrCreateProjectType('Residential')).toBe('pt-1');
    expect(prismaMock.projectType.create).not.toHaveBeenCalled();
  });

  it('creates a new one when the name is unknown', async () => {
    prismaMock.projectType.findUnique.mockResolvedValue(null);
    prismaMock.projectType.create.mockResolvedValue({ id: 'pt-new' });
    expect(await findOrCreateProjectType('Hospitality')).toBe('pt-new');
    expect(prismaMock.projectType.create).toHaveBeenCalledWith({ data: { name: 'Hospitality' } });
  });

  it('trims before looking up, so " Residential " is not a second type', async () => {
    prismaMock.projectType.findUnique.mockResolvedValue({ id: 'pt-1' });
    await findOrCreateProjectType('  Residential  ');
    expect(prismaMock.projectType.findUnique).toHaveBeenCalledWith({ where: { name: 'Residential' } });
  });

  it('treats blank input as "not set" and touches nothing', async () => {
    for (const blank of ['', '   ', null, undefined]) {
      expect(await findOrCreateProjectType(blank)).toBeNull();
    }
    expect(prismaMock.projectType.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.projectType.create).not.toHaveBeenCalled();
  });
});

describe('findOrCreateRoom', () => {
  it('is a no-op when the room already exists', async () => {
    prismaMock.projectRoom.findUnique.mockResolvedValue({ id: 'r-1' });
    await findOrCreateRoom('p1', 'Primary Bath');
    expect(prismaMock.projectRoom.create).not.toHaveBeenCalled();
  });

  it('creates the room scoped to the project, appended to the end', async () => {
    prismaMock.projectRoom.findUnique.mockResolvedValue(null);
    prismaMock.projectRoom.aggregate.mockResolvedValue({ _max: { order: 2 } });

    await findOrCreateRoom('p1', 'Kitchen');
    expect(prismaMock.projectRoom.create).toHaveBeenCalledWith({
      data: { projectId: 'p1', name: 'Kitchen', order: 3 },
    });
  });

  it('starts ordering at 0 for a project with no rooms yet', async () => {
    prismaMock.projectRoom.findUnique.mockResolvedValue(null);
    prismaMock.projectRoom.aggregate.mockResolvedValue({ _max: { order: null } });

    await findOrCreateRoom('p1', 'Kitchen');
    expect(prismaMock.projectRoom.create).toHaveBeenCalledWith({
      data: { projectId: 'p1', name: 'Kitchen', order: 0 },
    });
  });

  it('ignores blank names', async () => {
    for (const blank of ['', '  ', null, undefined]) {
      await findOrCreateRoom('p1', blank);
    }
    expect(prismaMock.projectRoom.findUnique).not.toHaveBeenCalled();
  });

  // Rooms are per-project, so the same name on two projects is two rows.
  it('scopes the lookup to the project', async () => {
    prismaMock.projectRoom.findUnique.mockResolvedValue(null);
    prismaMock.projectRoom.aggregate.mockResolvedValue({ _max: { order: null } });
    await findOrCreateRoom('project-7', 'Kitchen');
    expect(prismaMock.projectRoom.findUnique).toHaveBeenCalledWith({
      where: { projectId_name: { projectId: 'project-7', name: 'Kitchen' } },
    });
  });
});

describe('findOrCreateFeeStructureOption', () => {
  it('reuses an existing option within the same scope', async () => {
    prismaMock.feeStructureOption.findUnique.mockResolvedValue({ id: 'fs-1' });
    expect(await findOrCreateFeeStructureOption('Flat Fee', 'DESIGN_FEE')).toBe('fs-1');
    expect(prismaMock.feeStructureOption.create).not.toHaveBeenCalled();
  });

  it('creates within the requested scope, appended to the end', async () => {
    prismaMock.feeStructureOption.findUnique.mockResolvedValue(null);
    prismaMock.feeStructureOption.aggregate.mockResolvedValue({ _max: { order: 0 } });
    prismaMock.feeStructureOption.create.mockResolvedValue({ id: 'fs-new' });

    expect(await findOrCreateFeeStructureOption('Cost Plus', 'PROCUREMENT')).toBe('fs-new');
    expect(prismaMock.feeStructureOption.create).toHaveBeenCalledWith({
      data: { name: 'Cost Plus', scope: 'PROCUREMENT', order: 1 },
    });
  });

  // The same label can legitimately exist under both scopes.
  it('keys the lookup on scope as well as name', async () => {
    prismaMock.feeStructureOption.findUnique.mockResolvedValue(null);
    prismaMock.feeStructureOption.aggregate.mockResolvedValue({ _max: { order: null } });
    await findOrCreateFeeStructureOption('Flat Fee', 'DESIGN_FEE');
    expect(prismaMock.feeStructureOption.findUnique).toHaveBeenCalledWith({
      where: { scope_name: { scope: 'DESIGN_FEE', name: 'Flat Fee' } },
    });
  });

  it('ignores blank names', async () => {
    expect(await findOrCreateFeeStructureOption('   ', 'DESIGN_FEE')).toBeNull();
    expect(prismaMock.feeStructureOption.findUnique).not.toHaveBeenCalled();
  });
});

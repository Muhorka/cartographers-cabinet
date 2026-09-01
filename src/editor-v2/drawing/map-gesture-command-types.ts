export type Identity = { createId(): string; createRoomName(index: number): string };
export type Naming = { nameFor(subjectId: string, index: number): string; levelName(): string };

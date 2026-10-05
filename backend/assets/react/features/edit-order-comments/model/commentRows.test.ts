import {
  addDraft,
  afterSave,
  commentsPayload,
  editRow,
  removeDraft,
  rowsFrom,
} from './commentRows';

const SAVED = rowsFrom([
  {id: 1, content: 'first'},
  {id: 2, content: 'second'},
]);

describe('the comment rows of an order', () => {
  it('starts from the saved comments, each with its text', () => {
    expect(SAVED.map((row) => [row.id, row.text])).toEqual([
      [1, 'first'],
      [2, 'second'],
    ]);
  });

  it('sends every comment as it is on screen: saved ones by id, new ones without', () => {
    const rows = editRow(
      addDraft(editRow(SAVED, SAVED[0]!.key, 'edited')),
      'draft-1',
      'new',
    );

    expect(commentsPayload(rows)).toEqual([
      {id: 1, content: 'edited'},
      {id: 2, content: 'second'},
      {id: null, content: 'new'},
    ]);
  });

  it('leaves a comment out of what is sent to remove it from the order', () => {
    expect(commentsPayload(SAVED, SAVED[0]!.key)).toEqual([
      {id: 2, content: 'second'},
    ]);
  });

  it('never sends a blank comment (the API refuses one): a blank draft waits, a blanked one keeps its saved text', () => {
    const rows = editRow(addDraft(SAVED), SAVED[1]!.key, '   ');

    expect(commentsPayload(rows)).toEqual([
      {id: 1, content: 'first'},
      {id: 2, content: 'second'},
    ]);
  });

  it('numbers new drafts so each has its own key, and drops one without asking the server', () => {
    const rows = addDraft(addDraft(SAVED));

    expect(rows.slice(2).map((row) => [row.key, row.id, row.text])).toEqual([
      ['draft-1', null, ''],
      ['draft-2', null, ''],
    ]);
    expect(removeDraft(rows, 'draft-1').map((row) => row.key)).toEqual([
      SAVED[0]!.key,
      SAVED[1]!.key,
      'draft-2',
    ]);
  });

  it('takes the server’s comments after a save and keeps the blank drafts that were not sent', () => {
    const rows = editRow(addDraft(addDraft(SAVED)), 'draft-1', 'new');

    const next = afterSave(rows, [
      {id: 1, content: 'first'},
      {id: 2, content: 'second'},
      {id: 3, content: 'new'},
    ]);

    expect(next.map((row) => [row.id, row.text])).toEqual([
      [1, 'first'],
      [2, 'second'],
      [3, 'new'],
      [null, ''],
    ]);
    expect(next[3]!.key, 'the waiting draft keeps its key').toBe('draft-2');
  });
});

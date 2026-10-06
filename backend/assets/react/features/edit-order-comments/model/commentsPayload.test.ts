import {editedComments, withoutComment} from './commentsPayload';

const COMMENTS = [
  {id: 1, content: 'First'},
  {id: 2, content: 'Second'},
  {id: 3, content: null},
];

describe('the order’s comments as PUT /orders/{id}/comments takes them', () => {
  it('replaces one comment’s text and sends every other one as it is', () => {
    expect(editedComments(COMMENTS, 2, 'Changed')).toEqual([
      {id: 1, content: 'First'},
      {id: 2, content: 'Changed'},
      {id: 3, content: ''},
    ]);
  });

  it('leaves one comment out (the API detaches it from the order)', () => {
    expect(withoutComment(COMMENTS, 1)).toEqual([
      {id: 2, content: 'Second'},
      {id: 3, content: ''},
    ]);
  });
});

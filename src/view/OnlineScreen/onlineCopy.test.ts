import {
  RECONNECT_FAILED, RESUME_FAILURE_ERRORS, ROOM_CLOSED_ERRORS,
} from '../../network/onlineSession';
import { describeOnlineError, findOnlineProblem } from './onlineCopy';

describe('online problem copy', () => {
  it('explains each new refusal, and trying again later can help with all of them', () => {
    expect(findOnlineProblem('server busy')).toMatchObject({ title: 'The server is busy', retry: true });
    expect(findOnlineProblem('too many rooms')).toMatchObject({
      title: 'Too many rooms from your network', retry: true,
    });
    expect(findOnlineProblem('too many connections')).toMatchObject({
      title: 'Too many connections from your network', retry: true,
    });
  });

  it('has its own copy for every way the session can lose a room or a seat', () => {
    const texts = [
      ...Object.values(ROOM_CLOSED_ERRORS),
      ...Object.values(RESUME_FAILURE_ERRORS),
      RECONNECT_FAILED,
    ];
    expect(texts.filter((text) => !findOnlineProblem(text))).toEqual([]);
  });

  it('says plainly that a restart ended the match', () => {
    const problem = describeOnlineError(ROOM_CLOSED_ERRORS.restart);
    expect(`${problem.title}. ${problem.detail}`)
      .toMatch(/^The server restarted for an update\. Your match ended\. /);
    expect(problem.retry).toBe(false);
    // A seat that comes back after the restart hears the same thing.
    expect(RESUME_FAILURE_ERRORS['server-restarted']).toBe(ROOM_CLOSED_ERRORS.restart);
  });
});

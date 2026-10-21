/**
 * A path is a regular file, asked BEFORE anything opens it.
 *
 * A path a walk found or the command line named may be a directory, a named
 * pipe, a socket or a device. `open()` on a FIFO with no writer blocks for
 * ever: the read never returns, the `try/catch` around it never runs, and the
 * command never exits. Nothing here blocks — `stat(2)` answers at once — and a
 * symbolic link is followed exactly as a read would follow it, so a link to a
 * regular file is a regular file and a link to a pipe is a pipe.
 *
 * A path that is not there at all is not irregular: absence is the caller's
 * own finding, said in its own words (a missing registry, a missing config).
 */
import { statSync } from 'node:fs';

/** What stands at the path when it is not a regular file, or null when it is
 * one or is not there. */
export function notRegularFile(path) {
  let st;
  try { st = statSync(path); } catch { return null; }
  if (st.isFile()) return null;
  if (st.isDirectory()) return 'a directory';
  if (st.isFIFO()) return 'a named pipe';
  if (st.isSocket()) return 'a socket';
  if (st.isCharacterDevice() || st.isBlockDevice()) return 'a device';
  return 'neither a regular file nor a directory';
}

/** The sentence a refusal carries: it names the path, says it is not a regular
 * file, and says what stands there instead. */
export function notRegularFileSaid(path) {
  const what = notRegularFile(path);
  return what === null ? null : `${path} is not a regular file (it is ${what})`;
}

/** Refuse a path that is not a regular file, naming it, instead of blocking on
 * open(). An absent path passes through: the read's own error names it. */
export function requireRegularFile(path, what = 'the path') {
  const said = notRegularFileSaid(path);
  if (said !== null) throw new Error(`${what}: ${said}, so nothing is read from it`);
  return path;
}

export default { notRegularFile, notRegularFileSaid, requireRegularFile };

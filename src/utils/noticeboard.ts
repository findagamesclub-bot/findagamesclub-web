/**
 * What a noticeboard holds.
 *
 * In a util rather than beside the save, because the editor is a client
 * component and the service is `server-only`: the number has to be the same on
 * the screen that refuses to add an eleventh row and in the save that refuses
 * to write one, and two copies of it would disagree the first time either moved.
 */
export const MAX_NOTICES = 10;
export const MAX_NOTICE_LENGTH = 2000;

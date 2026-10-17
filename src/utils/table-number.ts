/**
 * Which table somebody is on, as a person counts them.
 *
 * `club_bookings.table_index` is a seat index and starts at 0, because a
 * partial unique index on it is what makes overbooking impossible rather than
 * unlikely. Nobody at a club calls the first table "table 0", so every screen
 * adds one. The booking confirmation email did not, and told everybody who
 * ever took the first table of the night that they were on table 0.
 *
 * Five copies of `+ 1` is how that happened, so there is one of it now.
 */
export const tableNumber = (index: number) => index + 1;

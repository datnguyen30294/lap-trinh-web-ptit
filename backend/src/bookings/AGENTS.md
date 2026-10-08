# Passenger bookings

Use the existing PassengerGuard and root environment. All reads and mutations are limited to the user ID from the session, including ADMIN accounts.

`bookings.controller.ts` exposes trip search/quote, create, owned receipts/list/detail, and cancellation. `booking.dto.ts` validates the public inputs. `bookings.service.ts` owns parameterized SQL and transactions. Relative imports use `.js` as in the backend.

One `bookings` row is one passenger. Keep the SQL schema and existing data. Fare uses the example query formula, availability uses the minimum remaining capacity on overlapping segments, and historical prices come from bookings.unit_price. QR contains only booking_code.

Create locks stations in ascending ID order, route, route_stops, vehicle, schedule, then bookings. Recheck the snapshot under locks. Cancellation locks schedule then booking and acquires no parent locks afterward. Both use READ COMMITTED. Convert numeric SQL flags with Number(value), since mysql2 may return computed flags as strings.

The user and request UUID determine the 24 character ticket code prefix. Retry unchanged payloads with the same UUID. Compare every existing passenger before returning the original ticket IDs. Do not collect payment, send email, delete cancellation history, or expose another owner's tickets.

Spec: `../../../docs/specs/0005-passenger-bookings.md`. MySQL integration tests: `../../test/bookings.e2e-spec.ts`, port 3105, isolated fixtures and original row checksums.

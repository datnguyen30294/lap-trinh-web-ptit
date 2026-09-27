SET NAMES utf8mb4;
SET time_zone = '+00:00';
USE gobus_hanoi_erd;

CREATE OR REPLACE VIEW v_route_details AS
SELECT r.id,r.code,r.name,a.name origin_name,z.name destination_name,
       r.operating_start,r.operating_end,r.distance_km,r.status,
       (SELECT COUNT(*) FROM route_stops rs WHERE rs.route_id=r.id) stop_count
FROM routes r JOIN stations a ON a.id=r.origin_station_id
JOIN stations z ON z.id=r.destination_station_id;

CREATE OR REPLACE VIEW v_schedule_details AS
SELECT s.id,s.route_id,r.code route_code,r.name route_name,
       s.vehicle_code,s.capacity,s.status,s.departure_at,s.arrival_at,
       CONVERT_TZ(s.departure_at,'+00:00','+07:00') departure_at_hanoi,
       CONVERT_TZ(s.arrival_at,'+00:00','+07:00') arrival_at_hanoi
FROM schedules s JOIN routes r ON r.id=s.route_id;

-- One row for each elementary segment; occupancy is NOT the sum of all tickets.
CREATE OR REPLACE VIEW v_segment_availability AS
SELECT s.id schedule_id,s.route_id,a.stop_order segment_order,
       a.station_id from_station_id,z.station_id to_station_id,s.capacity,
       (SELECT COUNT(*) FROM bookings b
        JOIN route_stops bf ON bf.route_id=s.route_id AND bf.station_id=b.from_station_id
        JOIN route_stops bt ON bt.route_id=s.route_id AND bt.station_id=b.to_station_id
        WHERE b.schedule_id=s.id AND b.status='CONFIRMED'
          AND bf.stop_order<=a.stop_order AND bt.stop_order>a.stop_order) occupied,
       s.capacity-(SELECT COUNT(*) FROM bookings b
        JOIN route_stops bf ON bf.route_id=s.route_id AND bf.station_id=b.from_station_id
        JOIN route_stops bt ON bt.route_id=s.route_id AND bt.station_id=b.to_station_id
        WHERE b.schedule_id=s.id AND b.status='CONFIRMED'
          AND bf.stop_order<=a.stop_order AND bt.stop_order>a.stop_order) remaining
FROM schedules s
JOIN route_stops a ON a.route_id=s.route_id
JOIN route_stops z ON z.route_id=s.route_id AND z.stop_order=a.stop_order+1;

CREATE OR REPLACE VIEW v_booking_details AS
SELECT b.id,b.booking_code,b.user_id,u.full_name booked_by,b.contact_name,b.contact_phone,
       b.schedule_id,r.code route_code,r.name route_name,
       a.name from_station,z.name to_station,b.unit_price,b.status,b.booked_at,b.cancelled_at,
       s.vehicle_code,s.departure_at,s.arrival_at,s.status schedule_status,
       TIMESTAMPADD(MINUTE,rs.minutes_from_origin,s.departure_at) pickup_at,
       TIMESTAMPADD(MINUTE,rt.minutes_from_origin,s.departure_at) dropoff_at
FROM bookings b JOIN users u ON u.id=b.user_id
JOIN schedules s ON s.id=b.schedule_id JOIN routes r ON r.id=s.route_id
JOIN stations a ON a.id=b.from_station_id JOIN stations z ON z.id=b.to_station_id
JOIN route_stops rs ON rs.route_id=r.id AND rs.station_id=b.from_station_id
JOIN route_stops rt ON rt.route_id=r.id AND rt.station_id=b.to_station_id;

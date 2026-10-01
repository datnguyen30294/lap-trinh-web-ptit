-- Read-only examples. Change parameters to the selected stations/date.
SET NAMES utf8mb4;
SET time_zone = '+00:00';
-- Select the target database before import.

-- 1. Routes and their ordered stops.
SELECT r.code,r.name,rs.stop_order,s.name station_name,
       rs.minutes_from_origin,rs.km_from_origin
FROM routes r JOIN route_stops rs ON rs.route_id=r.id
JOIN stations s ON s.id=rs.station_id
ORDER BY r.code,rs.stop_order;

-- 2. Search tomorrow: Trang Thi -> PTIT, on the same forward route.
SET @from_station=(SELECT id FROM stations WHERE code='HN-TT');
SET @to_station=(SELECT id FROM stations WHERE code='HN-PTIT');
SET @departure_date=DATE(UTC_TIMESTAMP()+INTERVAL 7 HOUR)+INTERVAL 1 DAY;
SET @utc_start=TIMESTAMP(@departure_date)-INTERVAL 7 HOUR;
SET @utc_end=@utc_start+INTERVAL 1 DAY;
SELECT sc.id schedule_id,r.code route_code,r.name route_name,
       vehicle.vehicle_code,vehicle.capacity,sc.departure_at,
       TIMESTAMPADD(MINUTE,a.minutes_from_origin,sc.departure_at) pickup_at_utc,
       CONVERT_TZ(TIMESTAMPADD(MINUTE,a.minutes_from_origin,sc.departure_at),'+00:00','+07:00') pickup_at_hanoi,
       CONVERT_TZ(TIMESTAMPADD(MINUTE,z.minutes_from_origin,sc.departure_at),'+00:00','+07:00') dropoff_at_hanoi,
       ROUND(4000+500*(z.km_from_origin-a.km_from_origin),0) demo_price,
       (SELECT MIN(v.remaining) FROM v_segment_availability v
        WHERE v.schedule_id=sc.id AND v.segment_order>=a.stop_order AND v.segment_order<z.stop_order) remaining_on_segment
FROM schedules sc
JOIN vehicles vehicle ON vehicle.id=sc.vehicle_id
JOIN routes r ON r.id=sc.route_id
JOIN route_stops a ON a.route_id=r.id AND a.station_id=@from_station
JOIN route_stops z ON z.route_id=r.id AND z.station_id=@to_station AND z.stop_order>a.stop_order
WHERE r.status='ACTIVE' AND sc.status='SCHEDULED'
  AND sc.departure_at>=@utc_start AND sc.departure_at<@utc_end AND sc.departure_at>UTC_TIMESTAMP(3)
  AND NOT EXISTS (SELECT 1 FROM route_stops rs JOIN stations st ON st.id=rs.station_id WHERE rs.route_id=r.id AND st.is_active=0)
ORDER BY pickup_at_utc;

-- 3. User's own bookings. The backend must derive @user_id from the session.
SET @user_id=(SELECT id FROM users WHERE email='an@gobus.local');
SELECT booking_code,passenger_name,route_code,from_station,to_station,
       unit_price,status,CONVERT_TZ(pickup_at,'+00:00','+07:00') pickup_at_hanoi
FROM v_booking_details WHERE user_id=@user_id ORDER BY booked_at DESC;

-- 4. Formula prices. Historic bookings.unit_price is never recalculated.
SELECT r.code,a.name from_station,z.name to_station,
       rs2.km_from_origin-rs1.km_from_origin distance_km,
       ROUND(4000+500*(rs2.km_from_origin-rs1.km_from_origin),0) demo_price
FROM routes r JOIN route_stops rs1 ON rs1.route_id=r.id
JOIN route_stops rs2 ON rs2.route_id=r.id AND rs2.stop_order>rs1.stop_order
JOIN stations a ON a.id=rs1.station_id JOIN stations z ON z.id=rs2.station_id
ORDER BY r.code,rs1.stop_order,rs2.stop_order;

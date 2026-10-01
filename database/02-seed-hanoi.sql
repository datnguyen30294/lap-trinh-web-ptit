-- Hanoi reference data; selected stops only. See database/README.md for sources.
-- Names and route corridors: public Hanoi references.
-- Km, offsets, operating hours, vehicle codes, capacity and dated schedules: DEMO.
-- Fares follow the coursework formula, not official Hanoi fares.
-- Seed is additive: existing records, prices, tickets and passwords are preserved.
-- Select the target database before import. Only use this seed for demo databases.
SET NAMES utf8mb4;
SET time_zone = '+00:00';
START TRANSACTION;
INSERT INTO stations(code,name,address) SELECT 'HN-BC','Bác Cổ - Trần Khánh Dư','Khu vực Trần Khánh Dư, Hà Nội' WHERE NOT EXISTS (SELECT 1 FROM stations WHERE code='HN-BC');
INSERT INTO stations(code,name,address) SELECT 'HN-TT','Tràng Thi','Phố Tràng Thi, Hà Nội' WHERE NOT EXISTS (SELECT 1 FROM stations WHERE code='HN-TT');
INSERT INTO stations(code,name,address) SELECT 'HN-NTS','Ngã Tư Sở','Khu vực Tây Sơn - Nguyễn Trãi, Hà Nội' WHERE NOT EXISTS (SELECT 1 FROM stations WHERE code='HN-NTS');
INSERT INTO stations(code,name,address) SELECT 'HN-PTIT','Học viện Công nghệ Bưu chính Viễn thông','Trần Phú, Hà Đông, Hà Nội' WHERE NOT EXISTS (SELECT 1 FROM stations WHERE code='HN-PTIT');
INSERT INTO stations(code,name,address) SELECT 'HN-YN','Bến xe Yên Nghĩa','Quốc lộ 6, khu vực Yên Nghĩa, Hà Nội' WHERE NOT EXISTS (SELECT 1 FROM stations WHERE code='HN-YN');
INSERT INTO stations(code,name,address) SELECT 'HN-MD','Mai Động','Bãi đỗ xe Kim Ngưu I, Hà Nội' WHERE NOT EXISTS (SELECT 1 FROM stations WHERE code='HN-MD');
INSERT INTO stations(code,name,address) SELECT 'HN-TN','Thanh Nhàn','Phố Thanh Nhàn, Hà Nội' WHERE NOT EXISTS (SELECT 1 FROM stations WHERE code='HN-TN');
INSERT INTO stations(code,name,address) SELECT 'HN-CB','Chùa Bộc','Phố Chùa Bộc, Hà Nội' WHERE NOT EXISTS (SELECT 1 FROM stations WHERE code='HN-CB');
INSERT INTO stations(code,name,address) SELECT 'HN-CG','Cầu Giấy','Đường Cầu Giấy, Hà Nội' WHERE NOT EXISTS (SELECT 1 FROM stations WHERE code='HN-CG');
INSERT INTO stations(code,name,address) SELECT 'HN-SVD','Sân vận động Quốc gia Mỹ Đình','Khu vực Lê Đức Thọ, Hà Nội' WHERE NOT EXISTS (SELECT 1 FROM stations WHERE code='HN-SVD');
INSERT INTO stations(code,name,address) SELECT 'HN-KM','Kim Mã','Số 1 Kim Mã, Hà Nội' WHERE NOT EXISTS (SELECT 1 FROM stations WHERE code='HN-KM');
INSERT INTO stations(code,name,address) SELECT 'HN-NT','Nhà chờ Núi Trúc','Khu vực Núi Trúc - Giảng Võ, Hà Nội' WHERE NOT EXISTS (SELECT 1 FROM stations WHERE code='HN-NT');
INSERT INTO stations(code,name,address) SELECT 'HN-GV','Nhà chờ Giảng Võ','Đường Giảng Võ, Hà Nội' WHERE NOT EXISTS (SELECT 1 FROM stations WHERE code='HN-GV');
INSERT INTO stations(code,name,address) SELECT 'HN-HDT','Nhà chờ Hoàng Đạo Thúy','Khu vực Hoàng Đạo Thúy - Lê Văn Lương, Hà Nội' WHERE NOT EXISTS (SELECT 1 FROM stations WHERE code='HN-HDT');
INSERT INTO stations(code,name,address) SELECT 'HN-TV','Nhà chờ Trung Văn','Đường Tố Hữu, khu vực Trung Văn, Hà Nội' WHERE NOT EXISTS (SELECT 1 FROM stations WHERE code='HN-TV');
INSERT INTO stations(code,name,address) SELECT 'HN-VP2','Nhà chờ Vạn Phúc 2','Đường Tố Hữu, khu vực Vạn Phúc, Hà Nội' WHERE NOT EXISTS (SELECT 1 FROM stations WHERE code='HN-VP2');
INSERT INTO stations(code,name,address) SELECT 'HN-VP1','Nhà chờ Vạn Phúc 1','Đường Tố Hữu, khu vực Vạn Phúc, Hà Nội' WHERE NOT EXISTS (SELECT 1 FROM stations WHERE code='HN-VP1');
INSERT INTO stations(code,name,address) SELECT 'HN-VK','Nhà chờ Văn Khê','Đường Tố Hữu, khu vực Văn Khê, Hà Nội' WHERE NOT EXISTS (SELECT 1 FROM stations WHERE code='HN-VK');
INSERT INTO stations(code,name,address) SELECT 'HN-CLK','Nhà chờ Cầu La Khê','Khu vực Cầu La Khê, Hà Nội' WHERE NOT EXISTS (SELECT 1 FROM stations WHERE code='HN-CLK');
INSERT INTO users(email,full_name,role,password_hash) SELECT 'admin@gobus.local','Quản trị viên GoBus','ADMIN','$2b$12$VB4YDS4RoVrEuNqNrH4jj..Q17Qbm3M2igDNhsbu1eR2zUZsmoRNW' WHERE NOT EXISTS (SELECT 1 FROM users WHERE email='admin@gobus.local');
INSERT INTO users(email,full_name,role,password_hash) SELECT 'an@gobus.local','Nguyễn Văn An (demo)','USER','$2b$12$XXXeYJsoGg67RbUJDrB.bOxsn2nBXiaxzGA.vxvpGRGZkgAj4Zy4u' WHERE NOT EXISTS (SELECT 1 FROM users WHERE email='an@gobus.local');
INSERT INTO users(email,full_name,role,password_hash) SELECT 'binh@gobus.local','Trần Thị Bình (demo)','USER','$2b$12$XXXeYJsoGg67RbUJDrB.bOxsn2nBXiaxzGA.vxvpGRGZkgAj4Zy4u' WHERE NOT EXISTS (SELECT 1 FROM users WHERE email='binh@gobus.local');

-- Route 02-DI; direction modeled separately.
INSERT INTO routes(code,name,origin_station_id,destination_station_id,operating_start,operating_end,distance_km)
SELECT '02-DI','Bác Cổ - Trần Khánh Dư → Bến xe Yên Nghĩa',a.id,z.id,'05:00:00','22:00:00',20 FROM stations a JOIN stations z ON z.code='HN-YN' WHERE a.code='HN-BC' AND NOT EXISTS (SELECT 1 FROM routes WHERE code='02-DI');
SET @rid=(SELECT id FROM routes WHERE code='02-DI');
INSERT INTO route_stops(route_id,station_id,stop_order,minutes_from_origin,km_from_origin) SELECT @rid,id,1,0,0 FROM stations WHERE code='HN-BC' AND NOT EXISTS (SELECT 1 FROM route_stops WHERE route_id=@rid AND stop_order=1);
INSERT INTO route_stops(route_id,station_id,stop_order,minutes_from_origin,km_from_origin) SELECT @rid,id,2,8,2 FROM stations WHERE code='HN-TT' AND NOT EXISTS (SELECT 1 FROM route_stops WHERE route_id=@rid AND stop_order=2);
INSERT INTO route_stops(route_id,station_id,stop_order,minutes_from_origin,km_from_origin) SELECT @rid,id,3,23,7 FROM stations WHERE code='HN-NTS' AND NOT EXISTS (SELECT 1 FROM route_stops WHERE route_id=@rid AND stop_order=3);
INSERT INTO route_stops(route_id,station_id,stop_order,minutes_from_origin,km_from_origin) SELECT @rid,id,4,40,12 FROM stations WHERE code='HN-PTIT' AND NOT EXISTS (SELECT 1 FROM route_stops WHERE route_id=@rid AND stop_order=4);
INSERT INTO route_stops(route_id,station_id,stop_order,minutes_from_origin,km_from_origin) SELECT @rid,id,5,65,20 FROM stations WHERE code='HN-YN' AND NOT EXISTS (SELECT 1 FROM route_stops WHERE route_id=@rid AND stop_order=5);

-- Route 02-VE; direction modeled separately.
INSERT INTO routes(code,name,origin_station_id,destination_station_id,operating_start,operating_end,distance_km)
SELECT '02-VE','Bến xe Yên Nghĩa → Bác Cổ - Trần Khánh Dư',a.id,z.id,'05:00:00','22:00:00',20 FROM stations a JOIN stations z ON z.code='HN-BC' WHERE a.code='HN-YN' AND NOT EXISTS (SELECT 1 FROM routes WHERE code='02-VE');
SET @rid=(SELECT id FROM routes WHERE code='02-VE');
INSERT INTO route_stops(route_id,station_id,stop_order,minutes_from_origin,km_from_origin) SELECT @rid,id,1,0,0 FROM stations WHERE code='HN-YN' AND NOT EXISTS (SELECT 1 FROM route_stops WHERE route_id=@rid AND stop_order=1);
INSERT INTO route_stops(route_id,station_id,stop_order,minutes_from_origin,km_from_origin) SELECT @rid,id,2,25,8 FROM stations WHERE code='HN-PTIT' AND NOT EXISTS (SELECT 1 FROM route_stops WHERE route_id=@rid AND stop_order=2);
INSERT INTO route_stops(route_id,station_id,stop_order,minutes_from_origin,km_from_origin) SELECT @rid,id,3,42,13 FROM stations WHERE code='HN-NTS' AND NOT EXISTS (SELECT 1 FROM route_stops WHERE route_id=@rid AND stop_order=3);
INSERT INTO route_stops(route_id,station_id,stop_order,minutes_from_origin,km_from_origin) SELECT @rid,id,4,57,18 FROM stations WHERE code='HN-TT' AND NOT EXISTS (SELECT 1 FROM route_stops WHERE route_id=@rid AND stop_order=4);
INSERT INTO route_stops(route_id,station_id,stop_order,minutes_from_origin,km_from_origin) SELECT @rid,id,5,65,20 FROM stations WHERE code='HN-BC' AND NOT EXISTS (SELECT 1 FROM route_stops WHERE route_id=@rid AND stop_order=5);

-- Route 26-DI; direction modeled separately.
INSERT INTO routes(code,name,origin_station_id,destination_station_id,operating_start,operating_end,distance_km)
SELECT '26-DI','Mai Động → Sân vận động Quốc gia Mỹ Đình',a.id,z.id,'05:00:00','22:00:00',18 FROM stations a JOIN stations z ON z.code='HN-SVD' WHERE a.code='HN-MD' AND NOT EXISTS (SELECT 1 FROM routes WHERE code='26-DI');
SET @rid=(SELECT id FROM routes WHERE code='26-DI');
INSERT INTO route_stops(route_id,station_id,stop_order,minutes_from_origin,km_from_origin) SELECT @rid,id,1,0,0 FROM stations WHERE code='HN-MD' AND NOT EXISTS (SELECT 1 FROM route_stops WHERE route_id=@rid AND stop_order=1);
INSERT INTO route_stops(route_id,station_id,stop_order,minutes_from_origin,km_from_origin) SELECT @rid,id,2,8,2 FROM stations WHERE code='HN-TN' AND NOT EXISTS (SELECT 1 FROM route_stops WHERE route_id=@rid AND stop_order=2);
INSERT INTO route_stops(route_id,station_id,stop_order,minutes_from_origin,km_from_origin) SELECT @rid,id,3,22,6 FROM stations WHERE code='HN-CB' AND NOT EXISTS (SELECT 1 FROM route_stops WHERE route_id=@rid AND stop_order=3);
INSERT INTO route_stops(route_id,station_id,stop_order,minutes_from_origin,km_from_origin) SELECT @rid,id,4,42,12 FROM stations WHERE code='HN-CG' AND NOT EXISTS (SELECT 1 FROM route_stops WHERE route_id=@rid AND stop_order=4);
INSERT INTO route_stops(route_id,station_id,stop_order,minutes_from_origin,km_from_origin) SELECT @rid,id,5,60,18 FROM stations WHERE code='HN-SVD' AND NOT EXISTS (SELECT 1 FROM route_stops WHERE route_id=@rid AND stop_order=5);

-- Route 26-VE; direction modeled separately.
INSERT INTO routes(code,name,origin_station_id,destination_station_id,operating_start,operating_end,distance_km)
SELECT '26-VE','Sân vận động Quốc gia Mỹ Đình → Mai Động',a.id,z.id,'05:00:00','22:00:00',18 FROM stations a JOIN stations z ON z.code='HN-MD' WHERE a.code='HN-SVD' AND NOT EXISTS (SELECT 1 FROM routes WHERE code='26-VE');
SET @rid=(SELECT id FROM routes WHERE code='26-VE');
INSERT INTO route_stops(route_id,station_id,stop_order,minutes_from_origin,km_from_origin) SELECT @rid,id,1,0,0 FROM stations WHERE code='HN-SVD' AND NOT EXISTS (SELECT 1 FROM route_stops WHERE route_id=@rid AND stop_order=1);
INSERT INTO route_stops(route_id,station_id,stop_order,minutes_from_origin,km_from_origin) SELECT @rid,id,2,18,6 FROM stations WHERE code='HN-CG' AND NOT EXISTS (SELECT 1 FROM route_stops WHERE route_id=@rid AND stop_order=2);
INSERT INTO route_stops(route_id,station_id,stop_order,minutes_from_origin,km_from_origin) SELECT @rid,id,3,38,12 FROM stations WHERE code='HN-CB' AND NOT EXISTS (SELECT 1 FROM route_stops WHERE route_id=@rid AND stop_order=3);
INSERT INTO route_stops(route_id,station_id,stop_order,minutes_from_origin,km_from_origin) SELECT @rid,id,4,52,16 FROM stations WHERE code='HN-TN' AND NOT EXISTS (SELECT 1 FROM route_stops WHERE route_id=@rid AND stop_order=4);
INSERT INTO route_stops(route_id,station_id,stop_order,minutes_from_origin,km_from_origin) SELECT @rid,id,5,60,18 FROM stations WHERE code='HN-MD' AND NOT EXISTS (SELECT 1 FROM route_stops WHERE route_id=@rid AND stop_order=5);

-- Route BRT01-DI; direction modeled separately.
INSERT INTO routes(code,name,origin_station_id,destination_station_id,operating_start,operating_end,distance_km)
SELECT 'BRT01-DI','Kim Mã → Bến xe Yên Nghĩa',a.id,z.id,'05:00:00','22:00:00',15 FROM stations a JOIN stations z ON z.code='HN-YN' WHERE a.code='HN-KM' AND NOT EXISTS (SELECT 1 FROM routes WHERE code='BRT01-DI');
SET @rid=(SELECT id FROM routes WHERE code='BRT01-DI');
INSERT INTO route_stops(route_id,station_id,stop_order,minutes_from_origin,km_from_origin) SELECT @rid,id,1,0,0 FROM stations WHERE code='HN-KM' AND NOT EXISTS (SELECT 1 FROM route_stops WHERE route_id=@rid AND stop_order=1);
INSERT INTO route_stops(route_id,station_id,stop_order,minutes_from_origin,km_from_origin) SELECT @rid,id,2,3,0.8 FROM stations WHERE code='HN-NT' AND NOT EXISTS (SELECT 1 FROM route_stops WHERE route_id=@rid AND stop_order=2);
INSERT INTO route_stops(route_id,station_id,stop_order,minutes_from_origin,km_from_origin) SELECT @rid,id,3,6,1.6 FROM stations WHERE code='HN-GV' AND NOT EXISTS (SELECT 1 FROM route_stops WHERE route_id=@rid AND stop_order=3);
INSERT INTO route_stops(route_id,station_id,stop_order,minutes_from_origin,km_from_origin) SELECT @rid,id,4,15,4.6 FROM stations WHERE code='HN-HDT' AND NOT EXISTS (SELECT 1 FROM route_stops WHERE route_id=@rid AND stop_order=4);
INSERT INTO route_stops(route_id,station_id,stop_order,minutes_from_origin,km_from_origin) SELECT @rid,id,5,25,7.6 FROM stations WHERE code='HN-TV' AND NOT EXISTS (SELECT 1 FROM route_stops WHERE route_id=@rid AND stop_order=5);
INSERT INTO route_stops(route_id,station_id,stop_order,minutes_from_origin,km_from_origin) SELECT @rid,id,6,30,9 FROM stations WHERE code='HN-VP2' AND NOT EXISTS (SELECT 1 FROM route_stops WHERE route_id=@rid AND stop_order=6);
INSERT INTO route_stops(route_id,station_id,stop_order,minutes_from_origin,km_from_origin) SELECT @rid,id,7,33,9.6 FROM stations WHERE code='HN-VP1' AND NOT EXISTS (SELECT 1 FROM route_stops WHERE route_id=@rid AND stop_order=7);
INSERT INTO route_stops(route_id,station_id,stop_order,minutes_from_origin,km_from_origin) SELECT @rid,id,8,38,11 FROM stations WHERE code='HN-VK' AND NOT EXISTS (SELECT 1 FROM route_stops WHERE route_id=@rid AND stop_order=8);
INSERT INTO route_stops(route_id,station_id,stop_order,minutes_from_origin,km_from_origin) SELECT @rid,id,9,44,12.6 FROM stations WHERE code='HN-CLK' AND NOT EXISTS (SELECT 1 FROM route_stops WHERE route_id=@rid AND stop_order=9);
INSERT INTO route_stops(route_id,station_id,stop_order,minutes_from_origin,km_from_origin) SELECT @rid,id,10,55,15 FROM stations WHERE code='HN-YN' AND NOT EXISTS (SELECT 1 FROM route_stops WHERE route_id=@rid AND stop_order=10);

-- Route BRT01-VE; direction modeled separately.
INSERT INTO routes(code,name,origin_station_id,destination_station_id,operating_start,operating_end,distance_km)
SELECT 'BRT01-VE','Bến xe Yên Nghĩa → Kim Mã',a.id,z.id,'05:00:00','22:00:00',15 FROM stations a JOIN stations z ON z.code='HN-KM' WHERE a.code='HN-YN' AND NOT EXISTS (SELECT 1 FROM routes WHERE code='BRT01-VE');
SET @rid=(SELECT id FROM routes WHERE code='BRT01-VE');
INSERT INTO route_stops(route_id,station_id,stop_order,minutes_from_origin,km_from_origin) SELECT @rid,id,1,0,0 FROM stations WHERE code='HN-YN' AND NOT EXISTS (SELECT 1 FROM route_stops WHERE route_id=@rid AND stop_order=1);
INSERT INTO route_stops(route_id,station_id,stop_order,minutes_from_origin,km_from_origin) SELECT @rid,id,2,11,2.4 FROM stations WHERE code='HN-CLK' AND NOT EXISTS (SELECT 1 FROM route_stops WHERE route_id=@rid AND stop_order=2);
INSERT INTO route_stops(route_id,station_id,stop_order,minutes_from_origin,km_from_origin) SELECT @rid,id,3,17,4 FROM stations WHERE code='HN-VK' AND NOT EXISTS (SELECT 1 FROM route_stops WHERE route_id=@rid AND stop_order=3);
INSERT INTO route_stops(route_id,station_id,stop_order,minutes_from_origin,km_from_origin) SELECT @rid,id,4,22,5.4 FROM stations WHERE code='HN-VP1' AND NOT EXISTS (SELECT 1 FROM route_stops WHERE route_id=@rid AND stop_order=4);
INSERT INTO route_stops(route_id,station_id,stop_order,minutes_from_origin,km_from_origin) SELECT @rid,id,5,25,6 FROM stations WHERE code='HN-VP2' AND NOT EXISTS (SELECT 1 FROM route_stops WHERE route_id=@rid AND stop_order=5);
INSERT INTO route_stops(route_id,station_id,stop_order,minutes_from_origin,km_from_origin) SELECT @rid,id,6,30,7.4 FROM stations WHERE code='HN-TV' AND NOT EXISTS (SELECT 1 FROM route_stops WHERE route_id=@rid AND stop_order=6);
INSERT INTO route_stops(route_id,station_id,stop_order,minutes_from_origin,km_from_origin) SELECT @rid,id,7,40,10.4 FROM stations WHERE code='HN-HDT' AND NOT EXISTS (SELECT 1 FROM route_stops WHERE route_id=@rid AND stop_order=7);
INSERT INTO route_stops(route_id,station_id,stop_order,minutes_from_origin,km_from_origin) SELECT @rid,id,8,49,13.4 FROM stations WHERE code='HN-GV' AND NOT EXISTS (SELECT 1 FROM route_stops WHERE route_id=@rid AND stop_order=8);
INSERT INTO route_stops(route_id,station_id,stop_order,minutes_from_origin,km_from_origin) SELECT @rid,id,9,52,14.2 FROM stations WHERE code='HN-NT' AND NOT EXISTS (SELECT 1 FROM route_stops WHERE route_id=@rid AND stop_order=9);
INSERT INTO route_stops(route_id,station_id,stop_order,minutes_from_origin,km_from_origin) SELECT @rid,id,10,55,15 FROM stations WHERE code='HN-KM' AND NOT EXISTS (SELECT 1 FROM route_stops WHERE route_id=@rid AND stop_order=10);

-- Dedicated demo vehicles. Capacity belongs to vehicles, not schedules.
INSERT INTO vehicles(vehicle_code,capacity)
SELECT CONCAT('DEMO-HN-',r.code),IF(r.code LIKE 'BRT01%',90,60) FROM routes r
WHERE r.code IN ('02-DI','02-VE','26-DI','26-VE','BRT01-DI','BRT01-VE')
AND NOT EXISTS (SELECT 1 FROM vehicles v WHERE v.vehicle_code=CONCAT('DEMO-HN-',r.code));

-- 14 days from the next Hanoi calendar day, 6 departures/day/direction.
-- Dedicated simulated vehicle per route direction; 3-hour headway avoids overlaps.
SET @hanoi_tomorrow=DATE(UTC_TIMESTAMP() + INTERVAL 7 HOUR) + INTERVAL 1 DAY;
INSERT INTO schedules(route_id,departure_at,arrival_at,vehicle_id)
WITH RECURSIVE days(n) AS (SELECT 0 UNION ALL SELECT n+1 FROM days WHERE n<13),
hours(h) AS (SELECT 6 UNION ALL SELECT 9 UNION ALL SELECT 12 UNION ALL SELECT 15 UNION ALL SELECT 18 UNION ALL SELECT 21),
departures AS (
 SELECT r.id route_id,v.id vehicle_id,
 TIMESTAMP(@hanoi_tomorrow + INTERVAL days.n DAY) + INTERVAL hours.h HOUR - INTERVAL 7 HOUR dep,
 (SELECT MAX(minutes_from_origin) FROM route_stops WHERE route_id=r.id) duration
 FROM routes r JOIN vehicles v ON v.vehicle_code=CONCAT('DEMO-HN-',r.code) CROSS JOIN days CROSS JOIN hours
 WHERE r.code IN ('02-DI','02-VE','26-DI','26-VE','BRT01-DI','BRT01-VE') AND r.status='ACTIVE'
) SELECT route_id,dep,TIMESTAMPADD(MINUTE,duration,dep),vehicle_id FROM departures d
WHERE duration IS NOT NULL AND NOT EXISTS (SELECT 1 FROM schedules s WHERE s.vehicle_id=d.vehicle_id AND s.departure_at=d.dep);

-- Three illustrative tickets: two confirmed, one cancelled. One row = one passenger.
SET @demo_schedule=(SELECT s.id FROM schedules s JOIN routes r ON r.id=s.route_id WHERE r.code='02-DI' AND s.status='SCHEDULED' AND s.departure_at>UTC_TIMESTAMP() ORDER BY s.departure_at LIMIT 1);
INSERT INTO bookings(booking_code,user_id,schedule_id,from_station_id,to_station_id,passenger_name,contact_phone,unit_price,status,booked_at,cancelled_at)
SELECT 'DEMO-HN-0001',u.id,s.id,a.id,z.id,'Nguyễn Văn An (demo)','0900000001',ROUND(4000+500*(rt.km_from_origin-rf.km_from_origin),0),'CONFIRMED',UTC_TIMESTAMP(3),NULL
FROM users u JOIN schedules s ON s.id=@demo_schedule JOIN stations a ON a.code='HN-BC' JOIN stations z ON z.code='HN-PTIT'
JOIN route_stops rf ON rf.route_id=s.route_id AND rf.station_id=a.id JOIN route_stops rt ON rt.route_id=s.route_id AND rt.station_id=z.id AND rt.stop_order>rf.stop_order
WHERE u.email='an@gobus.local' AND NOT EXISTS (SELECT 1 FROM bookings WHERE booking_code='DEMO-HN-0001');
INSERT INTO bookings(booking_code,user_id,schedule_id,from_station_id,to_station_id,passenger_name,contact_phone,unit_price,status,booked_at,cancelled_at)
SELECT 'DEMO-HN-0002',u.id,s.id,a.id,z.id,'Trần Thị Bình (demo)','0900000002',ROUND(4000+500*(rt.km_from_origin-rf.km_from_origin),0),'CONFIRMED',UTC_TIMESTAMP(3),NULL
FROM users u JOIN schedules s ON s.id=@demo_schedule JOIN stations a ON a.code='HN-TT' JOIN stations z ON z.code='HN-YN'
JOIN route_stops rf ON rf.route_id=s.route_id AND rf.station_id=a.id JOIN route_stops rt ON rt.route_id=s.route_id AND rt.station_id=z.id AND rt.stop_order>rf.stop_order
WHERE u.email='binh@gobus.local' AND NOT EXISTS (SELECT 1 FROM bookings WHERE booking_code='DEMO-HN-0002');
INSERT INTO bookings(booking_code,user_id,schedule_id,from_station_id,to_station_id,passenger_name,contact_phone,unit_price,status,booked_at,cancelled_at)
SELECT 'DEMO-HN-0003',u.id,s.id,a.id,z.id,'Nguyễn Văn An (demo)','0900000001',ROUND(4000+500*(rt.km_from_origin-rf.km_from_origin),0),'CANCELLED',UTC_TIMESTAMP(3),UTC_TIMESTAMP(3)
FROM users u JOIN schedules s ON s.id=@demo_schedule JOIN stations a ON a.code='HN-NTS' JOIN stations z ON z.code='HN-YN'
JOIN route_stops rf ON rf.route_id=s.route_id AND rf.station_id=a.id JOIN route_stops rt ON rt.route_id=s.route_id AND rt.station_id=z.id AND rt.stop_order>rf.stop_order
WHERE u.email='an@gobus.local' AND NOT EXISTS (SELECT 1 FROM bookings WHERE booking_code='DEMO-HN-0003');
COMMIT;

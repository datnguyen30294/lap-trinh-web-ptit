-- GoBus application schema (MySQL 8.4), aligned with the running application.
-- Select the target database before importing. Docker/setup-local.mjs does this.
-- Fresh database only; CREATE IF NOT EXISTS is not a migration for older schemas.
SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS `users` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `full_name` varchar(120) NOT NULL,
  `email` varchar(160) NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` enum('ADMIN','USER') NOT NULL DEFAULT 'USER',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`),
  CONSTRAINT `chk_users_active` CHECK ((`is_active` in (0,1))),
  CONSTRAINT `chk_users_email` CHECK ((char_length(trim(`email`)) > 0)),
  CONSTRAINT `chk_users_name` CHECK ((char_length(trim(`full_name`)) > 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `stations` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `code` varchar(20) NOT NULL,
  `name` varchar(160) NOT NULL,
  `address` varchar(255) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_stations_code` (`code`),
  KEY `idx_stations_name` (`name`),
  CONSTRAINT `chk_stations_active` CHECK ((`is_active` in (0,1))),
  CONSTRAINT `chk_stations_address` CHECK ((char_length(trim(`address`)) > 0)),
  CONSTRAINT `chk_stations_code` CHECK ((char_length(trim(`code`)) > 0)),
  CONSTRAINT `chk_stations_name` CHECK ((char_length(trim(`name`)) > 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `routes` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `code` varchar(20) NOT NULL,
  `name` varchar(180) NOT NULL,
  `origin_station_id` bigint unsigned NOT NULL,
  `destination_station_id` bigint unsigned NOT NULL,
  `operating_start` time NOT NULL,
  `operating_end` time NOT NULL,
  `distance_km` decimal(8,2) NOT NULL,
  `status` enum('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_routes_code` (`code`),
  KEY `idx_routes_search` (`origin_station_id`,`destination_station_id`),
  KEY `fk_routes_destination` (`destination_station_id`),
  CONSTRAINT `fk_routes_destination` FOREIGN KEY (`destination_station_id`) REFERENCES `stations` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_routes_origin` FOREIGN KEY (`origin_station_id`) REFERENCES `stations` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `chk_routes_code` CHECK ((char_length(trim(`code`)) > 0)),
  CONSTRAINT `chk_routes_distance` CHECK ((`distance_km` > 0)),
  CONSTRAINT `chk_routes_endpoints` CHECK ((`origin_station_id` <> `destination_station_id`)),
  CONSTRAINT `chk_routes_hours` CHECK (((`operating_start` >= '00:00:00') and (`operating_end` < '24:00:00') and (`operating_start` < `operating_end`))),
  CONSTRAINT `chk_routes_name` CHECK ((char_length(trim(`name`)) > 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `route_stops` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `route_id` bigint unsigned NOT NULL,
  `station_id` bigint unsigned NOT NULL,
  `stop_order` smallint unsigned NOT NULL,
  `km_from_origin` decimal(8,2) NOT NULL,
  `minutes_from_origin` smallint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_route_stops_order` (`route_id`,`stop_order`),
  UNIQUE KEY `uq_route_stops_station` (`route_id`,`station_id`),
  KEY `idx_route_stops_search` (`station_id`,`route_id`,`stop_order`),
  CONSTRAINT `fk_route_stops_route` FOREIGN KEY (`route_id`) REFERENCES `routes` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_route_stops_station` FOREIGN KEY (`station_id`) REFERENCES `stations` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `chk_route_stops_km` CHECK ((`km_from_origin` >= 0)),
  CONSTRAINT `chk_route_stops_order` CHECK ((`stop_order` > 0)),
  CONSTRAINT `chk_route_stops_origin` CHECK ((((`stop_order` = 1) and (`km_from_origin` = 0)) or ((`stop_order` > 1) and (`km_from_origin` > 0))))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `vehicles` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `vehicle_code` varchar(30) NOT NULL,
  `capacity` smallint unsigned NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `vehicle_code` (`vehicle_code`),
  CONSTRAINT `chk_vehicle_capacity` CHECK ((`capacity` > 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `schedules` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `route_id` bigint unsigned NOT NULL,
  `departure_at` datetime(3) NOT NULL,
  `arrival_at` datetime(3) NOT NULL,
  `vehicle_id` bigint unsigned NOT NULL,
  `status` enum('SCHEDULED','DEPARTED','COMPLETED','CANCELLED') NOT NULL DEFAULT 'SCHEDULED',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_schedules_vehicle_departure` (`vehicle_id`,`departure_at`),
  KEY `idx_schedules_search` (`route_id`,`departure_at`,`status`),
  KEY `idx_schedules_vehicle_period` (`vehicle_id`,`departure_at`,`arrival_at`),
  CONSTRAINT `fk_schedules_route` FOREIGN KEY (`route_id`) REFERENCES `routes` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_schedules_vehicle` FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `chk_schedules_time` CHECK ((`arrival_at` > `departure_at`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `bookings` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `booking_code` varchar(24) NOT NULL,
  `user_id` bigint unsigned NOT NULL,
  `schedule_id` bigint unsigned NOT NULL,
  `from_station_id` bigint unsigned NOT NULL,
  `to_station_id` bigint unsigned NOT NULL,
  `passenger_name` varchar(120) NOT NULL,
  `contact_phone` varchar(20) NOT NULL,
  `unit_price` decimal(10,2) NOT NULL,
  `status` enum('CONFIRMED','CANCELLED') NOT NULL DEFAULT 'CONFIRMED',
  `booked_at` datetime(3) NOT NULL DEFAULT (utc_timestamp(3)),
  `cancelled_at` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_bookings_code` (`booking_code`),
  KEY `idx_bookings_user_date` (`user_id`,`booked_at`),
  KEY `idx_bookings_capacity` (`schedule_id`,`status`,`from_station_id`,`to_station_id`),
  KEY `fk_bookings_from` (`from_station_id`),
  KEY `fk_bookings_to` (`to_station_id`),
  CONSTRAINT `fk_bookings_from` FOREIGN KEY (`from_station_id`) REFERENCES `stations` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_bookings_schedule` FOREIGN KEY (`schedule_id`) REFERENCES `schedules` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_bookings_to` FOREIGN KEY (`to_station_id`) REFERENCES `stations` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_bookings_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `chk_bookings_cancelled` CHECK ((((`status` = _utf8mb4'CONFIRMED') and (`cancelled_at` is null)) or ((`status` = _utf8mb4'CANCELLED') and (`cancelled_at` is not null) and (`cancelled_at` >= `booked_at`)))),
  CONSTRAINT `chk_bookings_contact` CHECK (((char_length(trim(`passenger_name`)) > 0) and (char_length(trim(`contact_phone`)) > 0))),
  CONSTRAINT `chk_bookings_price` CHECK ((`unit_price` >= 0)),
  CONSTRAINT `chk_bookings_segment` CHECK ((`from_station_id` <> `to_station_id`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

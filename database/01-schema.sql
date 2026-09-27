-- GoBus: physical model translated from CSDL.drawio.svg (7 business tables).
-- MySQL 8.0.16+ / 8.4. DATETIME values are UTC. Display with +07:00.
-- Non-destructive: this script never drops a database or table.
SET NAMES utf8mb4;
SET time_zone = '+00:00';
CREATE DATABASE IF NOT EXISTS gobus_hanoi_erd CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE gobus_hanoi_erd;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('ADMIN','USER') NOT NULL DEFAULT 'USER',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  CONSTRAINT chk_users_name CHECK (CHAR_LENGTH(TRIM(full_name)) > 0),
  CONSTRAINT chk_users_email CHECK (CHAR_LENGTH(TRIM(email)) > 0),
  CONSTRAINT chk_users_active CHECK (is_active IN (0,1))
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS stations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(20) NOT NULL,
  name VARCHAR(160) NOT NULL,
  address VARCHAR(255) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (id),
  UNIQUE KEY uq_stations_code (code),
  KEY idx_stations_name (name),
  CONSTRAINT chk_stations_code CHECK (CHAR_LENGTH(TRIM(code)) > 0),
  CONSTRAINT chk_stations_name CHECK (CHAR_LENGTH(TRIM(name)) > 0),
  CONSTRAINT chk_stations_address CHECK (CHAR_LENGTH(TRIM(address)) > 0),
  CONSTRAINT chk_stations_active CHECK (is_active IN (0,1))
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS routes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(20) NOT NULL,
  name VARCHAR(180) NOT NULL,
  origin_station_id BIGINT UNSIGNED NOT NULL,
  destination_station_id BIGINT UNSIGNED NOT NULL,
  operating_start TIME NOT NULL,
  operating_end TIME NOT NULL,
  distance_km DECIMAL(8,2) NOT NULL,
  status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  PRIMARY KEY (id),
  UNIQUE KEY uq_routes_code (code),
  KEY idx_routes_search (origin_station_id,destination_station_id,status),
  CONSTRAINT fk_routes_origin FOREIGN KEY (origin_station_id) REFERENCES stations(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_routes_destination FOREIGN KEY (destination_station_id) REFERENCES stations(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT chk_routes_code CHECK (CHAR_LENGTH(TRIM(code)) > 0),
  CONSTRAINT chk_routes_name CHECK (CHAR_LENGTH(TRIM(name)) > 0),
  CONSTRAINT chk_routes_endpoints CHECK (origin_station_id <> destination_station_id),
  CONSTRAINT chk_routes_hours CHECK (operating_start >= '00:00:00' AND operating_end < '24:00:00' AND operating_start < operating_end),
  CONSTRAINT chk_routes_distance CHECK (distance_km > 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS route_stops (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  route_id BIGINT UNSIGNED NOT NULL,
  station_id BIGINT UNSIGNED NOT NULL,
  stop_order SMALLINT UNSIGNED NOT NULL,
  minutes_from_origin SMALLINT UNSIGNED NOT NULL,
  km_from_origin DECIMAL(8,2) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_route_stops_order (route_id,stop_order),
  UNIQUE KEY uq_route_stops_station (route_id,station_id),
  KEY idx_route_stops_search (station_id,route_id,stop_order),
  CONSTRAINT fk_route_stops_route FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_route_stops_station FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT chk_route_stops_order CHECK (stop_order > 0),
  CONSTRAINT chk_route_stops_km CHECK (km_from_origin >= 0),
  CONSTRAINT chk_route_stops_origin CHECK ((stop_order = 1 AND minutes_from_origin = 0 AND km_from_origin = 0) OR (stop_order > 1 AND minutes_from_origin > 0 AND km_from_origin > 0))
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS schedules (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  route_id BIGINT UNSIGNED NOT NULL,
  departure_at DATETIME(3) NOT NULL,
  arrival_at DATETIME(3) NOT NULL,
  vehicle_code VARCHAR(30) NOT NULL,
  capacity SMALLINT UNSIGNED NOT NULL,
  status ENUM('SCHEDULED','DEPARTED','COMPLETED','CANCELLED') NOT NULL DEFAULT 'SCHEDULED',
  PRIMARY KEY (id),
  UNIQUE KEY uq_schedules_vehicle_departure (vehicle_code,departure_at),
  KEY idx_schedules_search (route_id,departure_at,status),
  KEY idx_schedules_vehicle_period (vehicle_code,departure_at,arrival_at),
  CONSTRAINT fk_schedules_route FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT chk_schedules_time CHECK (arrival_at > departure_at),
  CONSTRAINT chk_schedules_vehicle CHECK (CHAR_LENGTH(TRIM(vehicle_code)) > 0),
  CONSTRAINT chk_schedules_capacity CHECK (capacity BETWEEN 1 AND 32767)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS fares (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  route_id BIGINT UNSIGNED NOT NULL,
  from_station_id BIGINT UNSIGNED NOT NULL,
  to_station_id BIGINT UNSIGNED NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (id),
  UNIQUE KEY uq_fares_segment (route_id,from_station_id,to_station_id),
  CONSTRAINT fk_fares_route FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_fares_from_stop FOREIGN KEY (route_id,from_station_id) REFERENCES route_stops(route_id,station_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_fares_to_stop FOREIGN KEY (route_id,to_station_id) REFERENCES route_stops(route_id,station_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT chk_fares_segment CHECK (from_station_id <> to_station_id),
  CONSTRAINT chk_fares_price CHECK (price >= 0),
  CONSTRAINT chk_fares_active CHECK (is_active IN (0,1))
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS bookings (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  booking_code VARCHAR(24) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  schedule_id BIGINT UNSIGNED NOT NULL,
  from_station_id BIGINT UNSIGNED NOT NULL,
  to_station_id BIGINT UNSIGNED NOT NULL,
  contact_name VARCHAR(120) NOT NULL,
  contact_phone VARCHAR(20) NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  status ENUM('CONFIRMED','CANCELLED') NOT NULL DEFAULT 'CONFIRMED',
  booked_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
  cancelled_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_bookings_code (booking_code),
  KEY idx_bookings_user_date (user_id,booked_at),
  KEY idx_bookings_capacity (schedule_id,status,from_station_id,to_station_id),
  CONSTRAINT fk_bookings_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_bookings_schedule FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_bookings_from FOREIGN KEY (from_station_id) REFERENCES stations(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_bookings_to FOREIGN KEY (to_station_id) REFERENCES stations(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT chk_bookings_segment CHECK (from_station_id <> to_station_id),
  CONSTRAINT chk_bookings_contact CHECK (CHAR_LENGTH(TRIM(contact_name)) > 0 AND CHAR_LENGTH(TRIM(contact_phone)) > 0),
  CONSTRAINT chk_bookings_price CHECK (unit_price >= 0),
  CONSTRAINT chk_bookings_cancelled CHECK ((status = 'CONFIRMED' AND cancelled_at IS NULL) OR (status = 'CANCELLED' AND cancelled_at IS NOT NULL AND cancelled_at >= booked_at))
) ENGINE=InnoDB;

-- =============================================================================
-- STRESS INDEX — HRV Demographic Norms (Nunan 2010, Voss 2015, Schumann 2022)
-- Versione: 004
-- Eseguire dopo 001, 002, 003
-- =============================================================================
-- Replica esatta delle tabelle _rmssdTable / _sdnnTable / _lfhfTable / _dfaTable
-- / _siTable dell'app Flutter (lib/utils/demographic_normalization.dart).
-- Usata dal trigger compute_proprietary_scores (migrazione 005).
-- =============================================================================

DROP TABLE IF EXISTS hrv_norms CASCADE;

CREATE TABLE hrv_norms (
  metric       text NOT NULL,    -- 'rmssd','sdnn','lfhf','dfa','si'
  sex          text NOT NULL,    -- 'male','female'
  age_group    text NOT NULL,    -- 'young','midAdult','senior','elderly'
  fitness      text NOT NULL,    -- 'sedentary','active','athlete'
  p25          double precision NOT NULL,
  p50          double precision NOT NULL,
  p75          double precision NOT NULL,
  PRIMARY KEY (metric, sex, age_group, fitness)
);

-- Fallback general population (quando demografia incompleta)
DROP TABLE IF EXISTS hrv_norms_fallback CASCADE;

CREATE TABLE hrv_norms_fallback (
  metric text PRIMARY KEY,
  p25    double precision NOT NULL,
  p50    double precision NOT NULL,
  p75    double precision NOT NULL
);

INSERT INTO hrv_norms_fallback (metric, p25, p50, p75) VALUES
  ('rmssd', 17,   29,   46),
  ('sdnn',  28,   42,   58),
  ('lfhf',  0.8,  1.6,  3.0),
  ('dfa',   0.90, 1.06, 1.24),
  ('si',    65,   130,  230);

-- =============================================================================
-- RMSSD percentili
-- =============================================================================
INSERT INTO hrv_norms (metric, sex, age_group, fitness, p25, p50, p75) VALUES
('rmssd','male','young','sedentary',22,36,55),
('rmssd','male','young','active',34,52,72),
('rmssd','male','young','athlete',55,78,108),
('rmssd','male','midAdult','sedentary',18,30,46),
('rmssd','male','midAdult','active',28,44,62),
('rmssd','male','midAdult','athlete',45,66,90),
('rmssd','male','senior','sedentary',13,22,35),
('rmssd','male','senior','active',20,33,50),
('rmssd','male','senior','athlete',35,52,72),
('rmssd','male','elderly','sedentary',10,18,28),
('rmssd','male','elderly','active',15,26,40),
('rmssd','male','elderly','athlete',26,40,58),
('rmssd','female','young','sedentary',24,40,60),
('rmssd','female','young','active',36,56,78),
('rmssd','female','young','athlete',52,76,104),
('rmssd','female','midAdult','sedentary',18,32,50),
('rmssd','female','midAdult','active',28,46,66),
('rmssd','female','midAdult','athlete',44,64,88),
('rmssd','female','senior','sedentary',14,24,38),
('rmssd','female','senior','active',20,34,52),
('rmssd','female','senior','athlete',32,50,70),
('rmssd','female','elderly','sedentary',10,18,30),
('rmssd','female','elderly','active',15,26,40),
('rmssd','female','elderly','athlete',24,38,54);

-- =============================================================================
-- SDNN percentili
-- =============================================================================
INSERT INTO hrv_norms (metric, sex, age_group, fitness, p25, p50, p75) VALUES
('sdnn','male','young','sedentary',38,52,68),
('sdnn','male','young','active',52,68,86),
('sdnn','male','young','athlete',72,92,120),
('sdnn','male','midAdult','sedentary',32,46,62),
('sdnn','male','midAdult','active',44,60,78),
('sdnn','male','midAdult','athlete',62,82,106),
('sdnn','male','senior','sedentary',26,38,52),
('sdnn','male','senior','active',36,52,68),
('sdnn','male','senior','athlete',52,70,90),
('sdnn','male','elderly','sedentary',20,32,44),
('sdnn','male','elderly','active',28,42,58),
('sdnn','male','elderly','athlete',42,58,76),
('sdnn','female','young','sedentary',36,50,66),
('sdnn','female','young','active',48,64,82),
('sdnn','female','young','athlete',66,86,112),
('sdnn','female','midAdult','sedentary',28,42,58),
('sdnn','female','midAdult','active',40,56,74),
('sdnn','female','midAdult','athlete',56,74,96),
('sdnn','female','senior','sedentary',22,34,48),
('sdnn','female','senior','active',32,46,62),
('sdnn','female','senior','athlete',44,62,82),
('sdnn','female','elderly','sedentary',18,28,40),
('sdnn','female','elderly','active',24,38,54),
('sdnn','female','elderly','athlete',36,52,70);

-- =============================================================================
-- LF/HF percentili
-- =============================================================================
INSERT INTO hrv_norms (metric, sex, age_group, fitness, p25, p50, p75) VALUES
('lfhf','male','young','sedentary',0.8,1.5,2.8),
('lfhf','male','young','active',0.7,1.3,2.4),
('lfhf','male','young','athlete',0.5,1.0,1.8),
('lfhf','male','midAdult','sedentary',0.9,1.7,3.0),
('lfhf','male','midAdult','active',0.8,1.5,2.6),
('lfhf','male','midAdult','athlete',0.6,1.1,2.0),
('lfhf','male','senior','sedentary',1.0,1.9,3.4),
('lfhf','male','senior','active',0.9,1.7,3.0),
('lfhf','male','senior','athlete',0.7,1.3,2.4),
('lfhf','male','elderly','sedentary',1.1,2.1,3.8),
('lfhf','male','elderly','active',1.0,1.9,3.4),
('lfhf','male','elderly','athlete',0.8,1.5,2.8),
('lfhf','female','young','sedentary',0.7,1.3,2.4),
('lfhf','female','young','active',0.6,1.1,2.0),
('lfhf','female','young','athlete',0.5,0.9,1.7),
('lfhf','female','midAdult','sedentary',0.8,1.5,2.8),
('lfhf','female','midAdult','active',0.7,1.3,2.4),
('lfhf','female','midAdult','athlete',0.5,1.0,1.9),
('lfhf','female','senior','sedentary',0.9,1.7,3.0),
('lfhf','female','senior','active',0.8,1.5,2.7),
('lfhf','female','senior','athlete',0.6,1.2,2.2),
('lfhf','female','elderly','sedentary',1.0,1.9,3.4),
('lfhf','female','elderly','active',0.9,1.7,3.0),
('lfhf','female','elderly','athlete',0.7,1.3,2.4);

-- =============================================================================
-- DFA alpha1 percentili
-- =============================================================================
INSERT INTO hrv_norms (metric, sex, age_group, fitness, p25, p50, p75) VALUES
('dfa','male','young','sedentary',0.90,1.05,1.22),
('dfa','male','young','active',0.88,1.02,1.18),
('dfa','male','young','athlete',0.85,0.98,1.14),
('dfa','male','midAdult','sedentary',0.92,1.08,1.26),
('dfa','male','midAdult','active',0.90,1.05,1.22),
('dfa','male','midAdult','athlete',0.86,1.00,1.16),
('dfa','male','senior','sedentary',0.95,1.12,1.30),
('dfa','male','senior','active',0.92,1.08,1.26),
('dfa','male','senior','athlete',0.88,1.03,1.20),
('dfa','male','elderly','sedentary',0.98,1.16,1.36),
('dfa','male','elderly','active',0.95,1.12,1.30),
('dfa','male','elderly','athlete',0.90,1.06,1.24),
('dfa','female','young','sedentary',0.90,1.05,1.22),
('dfa','female','young','active',0.88,1.02,1.18),
('dfa','female','young','athlete',0.85,0.98,1.14),
('dfa','female','midAdult','sedentary',0.91,1.07,1.24),
('dfa','female','midAdult','active',0.89,1.04,1.20),
('dfa','female','midAdult','athlete',0.86,1.00,1.16),
('dfa','female','senior','sedentary',0.94,1.10,1.28),
('dfa','female','senior','active',0.91,1.07,1.24),
('dfa','female','senior','athlete',0.88,1.03,1.20),
('dfa','female','elderly','sedentary',0.97,1.14,1.34),
('dfa','female','elderly','active',0.94,1.10,1.28),
('dfa','female','elderly','athlete',0.90,1.06,1.24);

-- =============================================================================
-- Baevsky Stress Index percentili
-- =============================================================================
INSERT INTO hrv_norms (metric, sex, age_group, fitness, p25, p50, p75) VALUES
('si','male','young','sedentary',55,110,190),
('si','male','young','active',40,80,140),
('si','male','young','athlete',20,48,90),
('si','male','midAdult','sedentary',65,125,215),
('si','male','midAdult','active',50,96,165),
('si','male','midAdult','athlete',30,60,110),
('si','male','senior','sedentary',80,155,265),
('si','male','senior','active',62,120,205),
('si','male','senior','athlete',40,80,142),
('si','male','elderly','sedentary',100,190,320),
('si','male','elderly','active',80,155,265),
('si','male','elderly','athlete',60,110,185),
('si','female','young','sedentary',50,100,175),
('si','female','young','active',38,74,130),
('si','female','young','athlete',20,46,85),
('si','female','midAdult','sedentary',60,118,200),
('si','female','midAdult','active',46,88,155),
('si','female','midAdult','athlete',28,56,100),
('si','female','senior','sedentary',75,145,250),
('si','female','senior','active',58,112,195),
('si','female','senior','athlete',38,74,132),
('si','female','elderly','sedentary',90,175,300),
('si','female','elderly','active',72,140,245),
('si','female','elderly','athlete',55,100,170);

-- =============================================================================
-- VERIFICA
-- =============================================================================
SELECT metric, COUNT(*) AS combinazioni FROM hrv_norms GROUP BY metric ORDER BY metric;
-- Atteso: 5 righe, ognuna con 24 combinazioni

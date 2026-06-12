-- ------------------------------------------------------------
-- 1. infection_risks
-- ------------------------------------------------------------
ALTER TABLE public.infection_risks
  RENAME COLUMN message TO message_en;

ALTER TABLE public.infection_risks
  ADD COLUMN message_ar text;


-- ------------------------------------------------------------
-- 2. plans
-- ------------------------------------------------------------
ALTER TABLE public.plans
  RENAME COLUMN name TO name_en;

ALTER TABLE public.plans
  ADD COLUMN name_ar text;

ALTER TABLE public.plans
  RENAME COLUMN description TO description_en;

ALTER TABLE public.plans
  ADD COLUMN description_ar text;


-- ------------------------------------------------------------
-- 3. plan_features
-- ------------------------------------------------------------
ALTER TABLE public.plan_features
  RENAME COLUMN name TO name_en;

ALTER TABLE public.plan_features
  ADD COLUMN name_ar text;

ALTER TABLE public.plan_features
  RENAME COLUMN description TO description_en;

ALTER TABLE public.plan_features
  ADD COLUMN description_ar text;


-- ------------------------------------------------------------
-- 4. units
-- ------------------------------------------------------------
ALTER TABLE public.units
  RENAME COLUMN name TO name_en;

ALTER TABLE public.units
  ADD COLUMN name_ar text;

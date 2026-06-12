CREATE TABLE public.subscription_change_tokens (
  token_id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  new_plan_id uuid NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamp with time zone NOT NULL,
  used_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT subscription_change_tokens_pkey PRIMARY KEY (token_id),
  CONSTRAINT subscription_change_tokens_org_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(organization_id),
  CONSTRAINT subscription_change_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id),
  CONSTRAINT subscription_change_tokens_plan_id_fkey FOREIGN KEY (new_plan_id) REFERENCES public.plans(plan_id)
);

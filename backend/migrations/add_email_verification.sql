DO $$
DECLARE
    const_name text;
BEGIN
    SELECT conname INTO const_name
    FROM pg_constraint
    WHERE conrelid = 'users'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%status%';

    IF const_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE users DROP CONSTRAINT ' || const_name;
    END IF;
    
    ALTER TABLE users ADD CONSTRAINT users_status_check CHECK (status = ANY (ARRAY['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION']));
END $$;

CREATE TABLE IF NOT EXISTS public.email_verification_tokens (
  token_id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamp with time zone NOT NULL,
  used_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT email_verification_tokens_pkey PRIMARY KEY (token_id),
  CONSTRAINT email_verification_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE
);

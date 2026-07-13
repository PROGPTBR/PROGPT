import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const { data, error } = await supabase.auth.admin.updateUserById(
  '12fae419-12e9-427c-92ea-f5f61969e30c',
  {
    password: '4eh0i.c79o(J'
  }
)

console.log({ data, error })
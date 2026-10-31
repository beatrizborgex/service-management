
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    'As variáveis SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY precisam estar definidas.',
  )
}

const supabase = createClient(supabaseUrl, supabasePublishableKey)

export default supabase

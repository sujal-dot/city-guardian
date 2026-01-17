import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Simple in-memory rate limiting (per IP, per 15 minutes)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5; // 5 submissions per window
const RATE_WINDOW = 15 * 60 * 1000; // 15 minutes in milliseconds

function checkRateLimit(ip: string): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    // New window
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return { allowed: true, remaining: RATE_LIMIT - 1, resetIn: RATE_WINDOW };
  }

  if (entry.count >= RATE_LIMIT) {
    return { allowed: false, remaining: 0, resetIn: entry.resetAt - now };
  }

  entry.count++;
  return { allowed: true, remaining: RATE_LIMIT - entry.count, resetIn: entry.resetAt - now };
}

// Cleanup old entries periodically
function cleanupRateLimitMap() {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap.entries()) {
    if (now > entry.resetAt) {
      rateLimitMap.delete(ip);
    }
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get client IP from headers
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-real-ip") ||
      "unknown";

    // Check rate limit
    const rateCheck = checkRateLimit(clientIp);
    if (!rateCheck.allowed) {
      return new Response(
        JSON.stringify({
          error: "Rate limit exceeded",
          message: `Too many submissions. Please try again in ${Math.ceil(rateCheck.resetIn / 60000)} minutes.`,
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(Math.ceil(rateCheck.resetIn / 1000)),
          },
        }
      );
    }

    // Parse request body
    const body = await req.json();
    const { type, data } = body;

    if (!type || !data) {
      return new Response(
        JSON.stringify({ error: "Missing type or data in request body" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate submission type
    if (!["complaint", "sos"].includes(type)) {
      return new Response(
        JSON.stringify({ error: "Invalid submission type" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check for honeypot field (if filled, it's likely a bot)
    if (data.honeypot) {
      // Silently reject bot submissions
      return new Response(
        JSON.stringify({ success: true, id: "submitted" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create Supabase client with service role for inserting
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let result;

    if (type === "complaint") {
      // Validate required fields for complaints
      if (!data.description || !data.complaint_type || !data.location_name) {
        return new Response(
          JSON.stringify({ error: "Missing required fields for complaint" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Input validation
      if (data.description.length > 5000) {
        return new Response(
          JSON.stringify({ error: "Description too long (max 5000 characters)" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      if (data.location_name.length > 500) {
        return new Response(
          JSON.stringify({ error: "Location name too long (max 500 characters)" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      result = await supabase
        .from("complaints")
        .insert({
          user_id: null,
          description: data.description.trim(),
          complaint_type: data.complaint_type,
          location_name: data.location_name.trim(),
          latitude: data.latitude || null,
          longitude: data.longitude || null,
          submitted_from_ip: clientIp,
          needs_review: true,
        })
        .select()
        .single();
    } else if (type === "sos") {
      result = await supabase
        .from("sos_alerts")
        .insert({
          user_id: null,
          latitude: data.latitude || null,
          longitude: data.longitude || null,
          status: "active",
          submitted_from_ip: clientIp,
          needs_review: true,
        })
        .select()
        .single();
    }

    if (result?.error) {
      console.error("Database error:", result.error);
      return new Response(
        JSON.stringify({ error: "Failed to submit. Please try again." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Cleanup old rate limit entries occasionally
    if (Math.random() < 0.1) {
      cleanupRateLimitMap();
    }

    return new Response(
      JSON.stringify({
        success: true,
        id: result?.data?.id,
        message: type === "sos" 
          ? "SOS alert sent successfully. Help is on the way." 
          : "Complaint submitted successfully.",
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "X-RateLimit-Remaining": String(rateCheck.remaining),
        },
      }
    );
  } catch (error) {
    console.error("Error processing request:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

# Shared Nile Core authentication email

Nile Core is shared by NileStock and Zabuni. Its hosted authentication email templates are project-wide, so never paste a NileStock-only template into this project.

Before changing the live template:

1. Keep NileStock signup metadata set to `app_name: "nilestock"`.
2. Update Zabuni signup metadata to set `app_name: "zabuni"` when practical. Unmarked signups intentionally use the Zabuni design so existing Zabuni registration keeps working.
3. In **Authentication → Email Templates → Confirm sign up**, use this conditional subject:

   `{{ if eq .Data.app_name "nilestock" }}Confirm your NileStock account{{ else }}Confirm your Zabuni AI account{{ end }}`
4. Paste the contents of `shared-confirm-signup.html` as the body.

The template chooses the correct design using Supabase user metadata and treats unmarked accounts as Zabuni for backward compatibility. It intentionally uses `{{ .ConfirmationURL }}` so Supabase verifies the token before returning the user to the redirect supplied by the originating app.

Also add these under **Authentication → URL Configuration → Redirect URLs**:

- `http://localhost:3000/**`
- `https://*-titus-projects-4a3cc808.vercel.app/**`

Keep the final production domain as the Supabase **Site URL** only when NileStock is ready for production.

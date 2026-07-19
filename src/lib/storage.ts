/**
 * The Supabase Storage bucket that holds product photos. Shared by the public
 * read path (lib/queries.ts, lib/admin-catalogue.ts) and the admin upload
 * route so they all resolve the same bucket. Kept free of any Node-only
 * imports so it's safe to pull into client bundles. Matches the default
 * getProductImages() uses.
 */

export const BUCKET_NAME = process.env.S3_BUCKET_NAME ?? "Charmistry Assets";

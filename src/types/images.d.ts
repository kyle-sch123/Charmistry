/// <reference types="next/image-types/global" />

// Declares static image modules (*.webp, *.png, *.jpg, …) so a standalone
// `tsc --noEmit` resolves image imports. Next normally provides these via the
// build-generated, gitignored next-env.d.ts — which does not exist on a clean
// CI checkout, so we reference Next's image type declarations directly here.

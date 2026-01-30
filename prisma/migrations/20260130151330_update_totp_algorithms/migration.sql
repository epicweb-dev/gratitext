-- Update legacy algorithm names for @epic-web/totp v2.
UPDATE "Verification"
SET "algorithm" = 'SHA-1'
WHERE "algorithm" = 'SHA1';

UPDATE "Verification"
SET "algorithm" = 'SHA-256'
WHERE "algorithm" = 'SHA256';

UPDATE "Verification"
SET "algorithm" = 'SHA-512'
WHERE "algorithm" = 'SHA512';
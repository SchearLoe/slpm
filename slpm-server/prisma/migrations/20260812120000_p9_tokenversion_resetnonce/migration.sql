-- P9 安全加固（H3 + L2）：
--   tokenVersion：令牌版本号。重置密码时 +1，使所有历史 JWT 立即失效（解决"重置后旧 token 仍 7 天有效"）。
--   resetNonce：一次性密码重置随机数。forgot-password 写入，reset-password 校验后清空，防重置 token 在 15 分钟窗口内重放。
ALTER TABLE "User" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0,
                    ADD COLUMN "resetNonce" TEXT;

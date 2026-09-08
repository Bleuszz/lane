-- Honest defaults: the web tab is not the Chrome extension.
-- Preview placeholder shops (london_rails / lane_uk_shop) are purged in ensureUser.

alter table user_settings alter column extension_awake set default false;
update user_settings set extension_awake = false where extension_awake = true;

alter table marketplace_accounts alter column sandbox set default false;

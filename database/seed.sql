INSERT INTO Roles
  (id, name, description, status, created_at, updated_at, data_json)
VALUES
  ('role-admin', 'ADMIN', 'System administrator', 'Active',
   CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
   JSON_OBJECT('name', 'ADMIN', 'role', 'ADMIN'))
ON CONFLICT DO NOTHING;

INSERT INTO Users
  (id, username, password_hash, full_name, role_id, status,
   created_at, updated_at, data_json)
VALUES
  ('user-admin', 'kcmtadmin',
   '4281397d51c9da20cc2defb713d87bedf3f0c59a1fb5f1ba8da9a65b553b442d',
   'Administrator', 'role-admin', 'Active',
   CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
   JSON_OBJECT('username', 'kcmtadmin', 'fullName', 'Administrator', 'role', 'ADMIN'))
ON CONFLICT DO NOTHING;

INSERT INTO Permissions (id, permission_key, name, description, created_at, updated_at, data_json)
VALUES ('perm-reports-view', 'reports.view', 'Submit Reports', 'Preview and submit configured reports', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, JSON_OBJECT('permissionKey','reports.view'))
ON CONFLICT DO NOTHING;

INSERT INTO RolePermissions (role_id, permission_id, allowed)
SELECT 'role-admin', id, 1 FROM Permissions WHERE permission_key='reports.view'
ON CONFLICT DO NOTHING;



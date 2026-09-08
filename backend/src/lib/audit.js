export async function logAudit(supabase, {
  userId,
  userEmail,
  action,
  entityType,
  entityId = null,
  entityName = null,
  details = null,
  ipAddress = null,
}) {
  const { error } = await supabase.from('audit_logs').insert({
    user_id: userId,
    user_email: userEmail,
    action,
    entity_type: entityType,
    entity_id: entityId,
    entity_name: entityName,
    details,
    ip_address: ipAddress,
  });

  if (error) {
    console.error('Audit log failed:', error.message);
  }
}

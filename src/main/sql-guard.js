function normalizeSql(sql) {
  if (typeof sql !== 'string') {
    throw new Error('La sentencia SQL debe ser texto');
  }

  const normalized = sql.trim().replace(/;+\s*$/g, '');
  if (!normalized) {
    throw new Error('La sentencia SQL esta vacia');
  }
  if (normalized.length > 50000) {
    throw new Error('La sentencia SQL es demasiado larga');
  }

  return normalized;
}

function validateParams(params) {
  if (params == null) return [];
  if (!Array.isArray(params)) {
    throw new Error('Los parametros SQL deben enviarse como arreglo');
  }

  params.forEach((value) => {
    if (value === null) return;
    const type = typeof value;
    if (type === 'string' || type === 'number' || type === 'boolean') return;
    if (value instanceof Date) return;
    throw new Error('Se detecto un parametro SQL no soportado');
  });

  return params;
}

const BLOCKED_SQL_PATTERNS = [
  /--/,
  /\/\*/,
  /\*\//,
  /\bunion\b/i,
  /\bdrop\b/i,
  /\bexec\b/i,
  /\bexecute\b/i,
  /\battach\b/i,
  /\bdetach\b/i,
  /\bload_extension\b/i,
  /\bxp_\w+/i,
  /\bdeclare\b/i,
  /\bcast\s*\(/i,
  /\bconvert\s*\(/i,
  /\bsleep\s*\(/i,
  /\bwaitfor\b/i,
  /char\s*\(\s*\d/i,
  /0x[0-9a-f]{4,}/i,
];

function hasBlockedTokens(sql) {
  return BLOCKED_SQL_PATTERNS.some((pattern) => pattern.test(sql));
}

function isReadStatement(sql) {
  return /^(select|with)\b/i.test(sql);
}

function isAllowedPragma(sql) {
  return /^pragma\s+table_info\s*\(\s*[a-z_][a-z0-9_]*\s*\)$/i.test(sql);
}

function isWriteStatement(sql) {
  return /^(insert|update|delete)\b/i.test(sql);
}

function isAllowedSchemaMaintenance(sql) {
  return (
    /^create\s+table\s+if\s+not\s+exists\s+periodontograma\b/i.test(sql) ||
    /^alter\s+table\s+periodontograma\s+add\s+column\s+[a-z_][a-z0-9_]*\b/i.test(sql) ||
    /^create\s+table\s+if\s+not\s+exists\s+radiografias_paciente\b/i.test(sql) ||
    /^alter\s+table\s+radiografias_paciente\s+add\s+column\s+[a-z_][a-z0-9_]*\b/i.test(sql)
  );
}

function targetsProtectedAuthTable(sql) {
  return /^(insert(?:\s+or\s+replace)?\s+into|update|delete\s+from)\s+(usuarios|password_reset_tokens)\b/i.test(sql);
}

function targetsTypedWorkflowTables(sql) {
  return /^(insert(?:\s+or\s+replace)?\s+into|update|delete\s+from)\s+(pacientes|citas|especialistas|admin_config|tratamientos|tratamientos_catalogo|medicamentos|miscelanea|antecedentes_clinicos|padecimientos_default|radiografias_paciente|periodontograma|cajas|movimientos_caja|auditoria_financiera|planes_tratamiento|planes_tratamiento_historial|planes_financiamiento|cuotas_financiamiento|pagos_aplicaciones|facturas_simuladas|cobranza_recordatorios|planes_tratamiento_versiones|planes_tratamiento_cancelaciones|planes_tratamiento_diagnosticos|planes_tratamiento_medicinas|comunicacion_especialistas|pagos|crm_templates|crm_campaigns|crm_recordatorios|crm_encuestas|crm_encuestas_plantillas)\b/i.test(sql);
}

function assertSafeSql(channel, sql, params) {
  const normalizedSql = normalizeSql(sql);
  const safeParams = validateParams(params);

  if (hasBlockedTokens(normalizedSql) || normalizedSql.includes(';')) {
    throw new Error('La sentencia SQL fue bloqueada por seguridad');
  }

  if (channel === 'db-all' || channel === 'db-get') {
    if (!isReadStatement(normalizedSql) && !isAllowedPragma(normalizedSql)) {
      throw new Error('Solo se permiten consultas de lectura');
    }
    return { sql: normalizedSql, params: safeParams };
  }

  if (channel === 'db-run') {
    if (!isWriteStatement(normalizedSql) && !isAllowedSchemaMaintenance(normalizedSql)) {
      throw new Error('La operacion de escritura no esta permitida');
    }
    if (targetsProtectedAuthTable(normalizedSql)) {
      throw new Error('La tabla de autenticacion solo puede modificarse desde el modulo de auth');
    }
    if (targetsTypedWorkflowTables(normalizedSql)) {
      console.log('[DEBUG SQL-GUARD] Failing Query on Channel db-run:', normalizedSql);
      throw new Error('Esta escritura debe ejecutarse desde un modulo IPC tipado');
    }
    return { sql: normalizedSql, params: safeParams };
  }

  throw new Error(`Canal SQL no soportado: ${channel}`);
}

module.exports = {
  normalizeSql,
  assertSafeSql,
};

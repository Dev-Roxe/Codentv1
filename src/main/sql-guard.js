function normalizeSql(sql) {
  if (typeof sql !== 'string') {
    throw new Error('La sentencia SQL debe ser texto');
  }

  const normalized = sql.trim().replace(/;+\s*$/g, '');
  if (!normalized) {
    throw new Error('La sentencia SQL está vacía');
  }
  if (normalized.length > 50000) {
    throw new Error('La sentencia SQL es demasiado larga');
  }

  return normalized;
}

function validateParams(params) {
  if (params == null) return [];
  if (!Array.isArray(params)) {
    throw new Error('Los parámetros SQL deben enviarse como arreglo');
  }

  params.forEach((value) => {
    if (value === null) return;
    const type = typeof value;
    if (type === 'string' || type === 'number' || type === 'boolean') return;
    if (value instanceof Date) return;
    throw new Error('Se detectó un parámetro SQL no soportado');
  });

  return params;
}

// ⚠️ SECURITY FIX S6: Lista extendida de tokens peligrosos.
// Bloquea inyección SQL avanzada: UNION, DROP, EXEC, ATTACH, etc.
const BLOCKED_SQL_PATTERNS = [
  /--/,                         // Comentarios SQL inline
  /\/\*/,                       // Inicio comentario bloque
  /\*\//,                       // Fin comentario bloque
  /\bunion\b/i,                 // UNION (exfiltración de datos)
  /\bdrop\b/i,                  // DROP TABLE/INDEX
  /\bexec\b/i,                  // EXEC / sp_executesql
  /\bexecute\b/i,               // EXECUTE
  /\battach\b/i,                // ATTACH DATABASE
  /\bdetach\b/i,                // DETACH DATABASE
  /\bload_extension\b/i,        // Carga de extensiones SQLite
  /\bxp_\w+/i,                  // Stored procedures de SQL Server
  /\bdeclare\b/i,               // Declaración de variables T-SQL
  /\bcast\s*\(/i,               // CAST con funciones anidadas
  /\bconvert\s*\(/i,            // CONVERT
  /\bsleep\s*\(/i,              // Time-based blind injection
  /\bwaitfor\b/i,               // SQL Server delay
  /char\s*\(\s*\d/i,            // CHAR() encoding bypass
  /0x[0-9a-f]{4,}/i,            // Hex encoding bypass
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
    /^alter\s+table\s+periodontograma\s+add\s+column\s+[a-z_][a-z0-9_]*\b/i.test(sql)
  );
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
      throw new Error('La operación de escritura no está permitida');
    }
    return { sql: normalizedSql, params: safeParams };
  }

  throw new Error(`Canal SQL no soportado: ${channel}`);
}

module.exports = {
  normalizeSql,
  assertSafeSql,
};

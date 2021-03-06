var fs = require('fs');
var async = require('async');
var sequelize = require('sequelize');
var readTable = require('./lib/readTable');
var fileFromEnum = require('./lib/fileFromEnum');
var enumsFromTable = require('./lib/enumsFromTable');
var sqlConnectionFactory = require('./lib/sqlConnectionFactory');

function tableDefinition(def) {
  return {
    file: def.file,
    // [STR] Relative path to the file
    table: def.table,
    // [STR] Table name from the database
    keyColumn: def.keyColumn,
    // [STR] Column to key enum off of
    keyTransform: def.keyTransform || stringify,
    // [FN(enumKeys)] FN to transform keys
    tableFilter: def.tableFilter || alwaysTrue,
    // [FN(tableRows)] FN to filter table rows
    valueColumns: def.valueColumns,
    // [Array[STR]] Creates one enum per value column
    valueTransform: def.valueTransform || respectType
    // [FN(enumValues)] FN to transform values
  };

  function alwaysTrue() { return true; }

  function stringify(v) {
    return "'" + v + "'";
  }

  function respectType(v) {
    if(typeof v === 'string') return "'" + v + "'";
    return v;
  }
}

function writeConstantsDirectory(
  sqlParams,
  directoryPath,
  tableDefinitions,
  done
) {
  const definitionWrapper = tableDefinitions.map(function(d){
    return { def: d, table: [], enums: [] };
  });

  let sqlConnPool = null;
  const connectToSql = (done) => {
    let firstTime = !sqlConnPool;
    if (!firstTime) sqlConnPool.removeListener('error', connectToSql);
    sqlConnPool = sqlConnectionFactory(
      sqlParams,
      (sqlConnErr, sqlConn) => {
        if (sqlConnErr) setTimeout(connectToSql, 5000);
        sqlConnPool = sqlConn;
        done(sqlConn);
      }
    );
  };

  connectToSql((sqlConnectionPool) => {
    async.series([
      mapFn(readTable(sqlConnectionPool), definitionWrapper),
      mapFn(enumsFromTable(), definitionWrapper),
      mapFn(fileFromEnum(directoryPath, tableDefinitions), definitionWrapper)
    ], done);
  });
};

function mapFn(op, list) {
  return function mappedFn (cb) {
    async.map(list, op, cb);
  };
}

module.exports = {
  tableDefinition: tableDefinition,
  createConstantFiles: writeConstantsDirectory
};

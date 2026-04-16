import React, { useEffect, useState } from 'react';
import { Terminal, Shield, User, AlertTriangle, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { adminEndpoints } from '../api';

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const { data } = await adminEndpoints.getLogs();
        setLogs(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  const getLogIcon = (action) => {
    if (action.includes('ban')) return <AlertTriangle className="text-red-400" size={18} />;
    if (action.includes('login')) return <Shield className="text-green-400" size={18} />;
    return <User className="text-blue-400" size={18} />;
  };

  if (loading) return <div className="p-8 text-gray-400">Loading audit trail...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-8">
         <div className="flex items-center gap-3">
            <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                <Terminal size={24} className="text-indigo-400" />
            </div>
            <div>
                <h3 className="text-xl font-bold">System Event Stream</h3>
                <p className="text-sm text-gray-500">Real-time log of administrative actions</p>
            </div>
         </div>
         <button className="btn-secondary text-sm">Download CSV</button>
      </div>

      <div className="glass overflow-hidden">
        <div className="max-h-[600px] overflow-y-auto">
          {logs.length === 0 ? (
            <div className="p-20 text-center text-gray-500">
               <Clock size={48} className="mx-auto mb-4 opacity-20" />
               <p>No logged events found in the audit trail.</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {logs.map((log, i) => (
                <motion.div 
                  key={log.id}
                  initial={{ x: -10, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  className="p-4 hover:bg-white/5 flex items-start gap-4"
                >
                  <div className="p-2 bg-white/5 rounded-lg shrink-0">
                    {getLogIcon(log.action)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-medium text-sm text-gray-200">
                         {log.action.replace('_', ' ').toUpperCase()} 
                         <span className="text-gray-500 font-normal ml-2">by Admin</span>
                      </p>
                      <p className="text-xs text-indigo-400/80 font-mono">
                        {new Date(log.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <p className="text-sm text-gray-500 truncate">
                      Entity ID: <span className="text-gray-400 font-mono">{log.entity_id || 'N/A'}</span>
                    </p>
                    {log.metadata && (
                        <div className="mt-2 text-xs bg-black/20 p-2 rounded font-mono text-gray-400 border border-white/5">
                            {JSON.stringify(log.metadata)}
                        </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuditLogs;

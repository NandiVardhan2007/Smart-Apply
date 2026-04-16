import React, { useEffect, useState } from 'react';
import { Users, Briefcase, UserCheck, UserX, TrendingUp, Activity } from 'lucide-react';
import { motion } from 'framer-motion';
import { adminEndpoints } from '../api';

const Dashboard = () => {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const { data } = await adminEndpoints.getMetrics();
        setMetrics(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchMetrics();
  }, []);

  if (loading) return <div className="p-8 text-gray-400">Loading metrics...</div>;

  const cards = [
    { label: 'Total Users', value: metrics?.total_users || 0, icon: <Users size={24} />, color: 'from-blue-500 to-indigo-500' },
    { label: 'Active Users', value: metrics?.active_users || 0, icon: <UserCheck size={24} />, color: 'from-green-500 to-emerald-500' },
    { label: 'Banned Users', value: metrics?.banned_users || 0, icon: <UserX size={24} />, color: 'from-red-500 to-rose-500' },
    { label: 'Total Applications', value: metrics?.total_applications || 0, icon: <Briefcase size={24} />, color: 'from-amber-500 to-orange-500' },
  ];

  return (
    <div className="space-y-8">
      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: i * 0.1 }}
            className="glass p-6 card-hover group"
          >
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 rounded-xl bg-gradient-to-tr ${card.color} shadow-lg shadow-black/20 group-hover:scale-110 transition-transform`}>
                {card.icon}
              </div>
              <div className="flex items-center gap-1 text-green-400 text-sm font-medium">
                <TrendingUp size={16} />
                <span>+12%</span>
              </div>
            </div>
            <p className="text-gray-400 text-sm font-medium">{card.label}</p>
            <h3 className="text-3xl font-bold mt-1">{card.value.toLocaleString()}</h3>
          </motion.div>
        ))}
      </div>

      {/* System Status Table Mock */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Activity size={20} className="text-indigo-400" />
              Platform Traffic
            </h3>
            <select className="bg-white/5 border border-white/10 rounded-lg px-3 py-1 text-sm text-gray-400">
               <option>Last 24 Hours</option>
               <option>Last 7 Days</option>
            </select>
          </div>
          <div className="h-64 flex items-end justify-between gap-2 px-2">
            {[40, 60, 35, 75, 45, 90, 55, 65, 30, 80, 50, 70].map((h, i) => (
              <motion.div 
                key={i}
                initial={{ height: 0 }}
                animate={{ height: `${h}%` }}
                className="flex-1 bg-gradient-to-t from-indigo-500/20 to-indigo-500/60 rounded-t-sm hover:from-indigo-500/40 transition-all pointer-events-auto cursor-help"
                title={`${h}% usage`}
              />
            ))}
          </div>
        </div>

        <div className="glass p-6">
          <h3 className="text-lg font-bold mb-6">Recent Reports</h3>
          <div className="space-y-4">
            {[1, 2, 3, 4].map((_, i) => (
                 <div key={i} className="flex gap-4 p-3 rounded-xl hover:bg-white/5 cursor-pointer transition-colors">
                    <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                        <Users size={18} className="text-gray-400" />
                    </div>
                    <div>
                        <p className="text-sm font-medium">User Registration Spike</p>
                        <p className="text-xs text-gray-500">24 mins ago</p>
                    </div>
                 </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

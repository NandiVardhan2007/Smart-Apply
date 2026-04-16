import React, { useEffect, useState } from 'react';
import { Search, MoreVertical, Ban, CheckCircle, ExternalLink, Filter } from 'lucide-react';
import { motion } from 'framer-motion';
import { adminEndpoints } from '../api';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchUsers = async () => {
    try {
      const { data } = await adminEndpoints.getUsers();
      setUsers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleBanToggle = async (userId, isCurrentlyBanned) => {
    const reason = window.prompt(isCurrentlyBanned ? 'Unban reason?' : 'Why are you banning this user?');
    if (reason === null) return;
    
    try {
      await adminEndpoints.banUser(userId, reason);
      fetchUsers();
    } catch (err) {
      alert('Action failed: ' + (err.response?.data?.detail || 'Unknown error'));
    }
  };

  const filteredUsers = users.filter(u => 
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="p-8 text-gray-400">Loading user database...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/5">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          />
        </div>
        <div className="flex gap-2">
           <button className="btn-secondary flex items-center gap-2 py-2 px-4 text-sm">
             <Filter size={16} /> Filters
           </button>
           <p className="text-sm text-gray-400 py-2 px-3">
             Showing {filteredUsers.length} users
           </p>
        </div>
      </div>

      <div className="glass overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-white/5 text-gray-400 text-xs font-bold uppercase tracking-wider">
              <th className="px-6 py-4">User</th>
              <th className="px-6 py-4">Role</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Verification</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filteredUsers.map((user, i) => (
              <motion.tr 
                key={user.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.05 }}
                className="hover:bg-white/5 transition-colors"
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center font-bold text-gray-400">
                      {user.email[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium">{user.full_name || 'Anonymous User'}</p>
                      <p className="text-sm text-gray-500">{user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-md text-xs font-bold ${
                    user.role === 'admin' ? 'bg-purple-500/20 text-purple-400' : 'bg-gray-500/20 text-gray-400'
                  }`}>
                    {user.role?.toUpperCase() || 'USER'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className={`flex items-center gap-1.5 ${user.is_banned ? 'text-red-400' : 'text-green-400'}`}>
                    {user.is_banned ? <Ban size={14} /> : <CheckCircle size={14} />}
                    <span className="text-sm">{user.is_banned ? 'Banned' : 'Active'}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                   <p className="text-sm text-gray-400">Verified</p>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button 
                      onClick={() => handleBanToggle(user.id, user.is_banned)}
                      className={`p-2 rounded-lg transition-colors ${
                        user.is_banned ? 'hover:bg-green-400/10 text-green-400' : 'hover:bg-red-400/10 text-red-500'
                      }`}
                      title={user.is_banned ? 'Unban User' : 'Ban User'}
                    >
                      {user.is_banned ? <CheckCircle size={18} /> : <Ban size={18} />}
                    </button>
                    <button className="p-2 hover:bg-white/10 rounded-lg text-gray-400">
                      <ExternalLink size={18} />
                    </button>
                    <button className="p-2 hover:bg-white/10 rounded-lg text-gray-400">
                      <MoreVertical size={18} />
                    </button>
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UserManagement;

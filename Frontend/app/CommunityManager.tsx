import React, { useState } from 'react';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';

const CommunityManager = () => {
  const [view, setView] = useState('list');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [myCommunities, setMyCommunities] = useState([
    {
      id: 1,
      name: 'Tech Hostel A',
      type: 'Hostel',
      role: 'Head',
      members: 45,
      color: 'bg-blue-500',
      isPublic: true
    },
    {
      id: 2,
      name: 'Sports Club',
      type: 'Club',
      role: 'Admin',
      members: 120,
      color: 'bg-green-500',
      isPublic: true
    }
  ]);

  const [allCommunities, setAllCommunities] = useState([
    {
      id: 1,
      name: 'Tech Hostel A',
      type: 'Hostel',
      members: 45,
      color: 'bg-blue-500',
      isPublic: true,
      joined: true
    },
    {
      id: 2,
      name: 'Sports Club',
      type: 'Club',
      members: 120,
      color: 'bg-green-500',
      isPublic: true,
      joined: true
    },
    {
      id: 3,
      name: 'Student Council',
      type: 'Organization',
      members: 89,
      color: 'bg-purple-500',
      isPublic: true,
      joined: false
    },
    {
      id: 4,
      name: 'Music Society',
      type: 'Club',
      members: 67,
      color: 'bg-pink-500',
      isPublic: true,
      joined: false
    },
    {
      id: 5,
      name: 'Business Apartment',
      type: 'Apartment',
      members: 30,
      color: 'bg-indigo-500',
      isPublic: false,
      joined: false
    }
  ]);

  const [formData, setFormData] = useState({
    name: '',
    type: 'Hostel',
    description: '',
    role: 'Head',
    isPublic: true
  });

  const templates = [
    { id: 'Hostel', icon: Home, label: 'Hostel', color: 'bg-blue-500' },
    { id: 'Apartment', icon: Building2, label: 'Apartment', color: 'bg-indigo-500' },
    { id: 'Club', icon: Trophy, label: 'Club', color: 'bg-green-500' },
    { id: 'Organization', icon: Briefcase, label: 'Organization', color: 'bg-purple-500' }
  ];

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : value 
    }));
  };

  const handleCreateCommunity = () => {
    if (!formData.name.trim()) {
      alert('Please enter a community name');
      return;
    }

    const template = templates.find(t => t.id === formData.type);
    const newCommunity = {
      id: allCommunities.length + 1,
      name: formData.name,
      type: formData.type,
      members: 1,
      color: template.color,
      isPublic: formData.isPublic,
      joined: true
    };
    
    setAllCommunities([...allCommunities, newCommunity]);
    setMyCommunities([...myCommunities, {
      ...newCommunity,
      role: formData.role
    }]);
    
    setFormData({ name: '', type: 'Hostel', description: '', role: 'Head', isPublic: true });
    setView('list');
  };

  const handleJoinCommunity = (communityId) => {
    const community = allCommunities.find(c => c.id === communityId);
    if (community.isPublic) {
      setAllCommunities(allCommunities.map(c => 
        c.id === communityId ? { ...c, joined: true, members: c.members + 1 } : c
      ));
      setMyCommunities([...myCommunities, {
        ...community,
        role: 'Member',
        members: community.members + 1
      }]);
    } else {
      alert('This is a private community. You need an invitation to join.');
    }
  };

  const handleLeaveCommunity = (communityId) => {
    setAllCommunities(allCommunities.map(c => 
      c.id === communityId ? { ...c, joined: false, members: c.members - 1 } : c
    ));
    setMyCommunities(myCommunities.filter(c => c.id !== communityId));
  };

  const filteredCommunities = allCommunities.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Users className="w-8 h-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">Community Manager</h1>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setView('join')}
                className="flex items-center space-x-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition"
              >
                <Search className="w-5 h-5" />
                <span>Join Community</span>
              </button>
              <button
                onClick={() => setView('create')}
                className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
              >
                <Plus className="w-5 h-5" />
                <span>Create</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {view === 'list' ? (
          // My Communities List View
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-800">My Communities</h2>
              <span className="text-sm text-gray-500">{myCommunities.length} communities</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {myCommunities.map(community => (
                <div
                  key={community.id}
                  className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer overflow-hidden"
                >
                  <div className={`h-32 ${community.color} relative`}>
                    <div className="absolute inset-0 bg-gradient-to-br from-transparent to-black/20"></div>
                    <div className="absolute top-3 right-3">
                      <button className="p-2 bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/30 transition">
                        <MoreVertical className="w-4 h-4 text-white" />
                      </button>
                    </div>
                  </div>

                  <div className="p-5">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {community.name}
                    </h3>
                    <p className="text-sm text-gray-500 mb-4">{community.type}</p>

                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center space-x-1 text-gray-600">
                        <User className="w-4 h-4" />
                        <span>{community.members} members</span>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        community.role === 'Head' ? 'bg-blue-100 text-blue-700' :
                        community.role === 'Admin' ? 'bg-purple-100 text-purple-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {community.role}
                      </span>
                    </div>
                  </div>
                </div>
              ))}

              <div
                onClick={() => setView('join')}
                className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer overflow-hidden border-2 border-dashed border-gray-300 hover:border-blue-500"
              >
                <div className="h-full flex flex-col items-center justify-center p-8 text-center min-h-[280px]">
                  <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
                    <Search className="w-8 h-8 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Join Community
                  </h3>
                  <p className="text-sm text-gray-500">
                    Discover and join existing communities
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : view === 'join' ? (
          // Join Community View
          <div>
            <button
              onClick={() => setView('list')}
              className="mb-6 text-blue-600 hover:text-blue-700 flex items-center space-x-2"
            >
              <span>← Back to My Communities</span>
            </button>

            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search communities by name or type..."
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <h2 className="text-xl font-semibold text-gray-800 mb-6">Available Communities</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCommunities.map(community => (
                <div
                  key={community.id}
                  className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                >
                  <div className={`h-32 ${community.color} relative`}>
                    <div className="absolute inset-0 bg-gradient-to-br from-transparent to-black/20"></div>
                    <div className="absolute top-3 right-3">
                      {community.isPublic ? (
                        <div className="flex items-center space-x-1 bg-white/20 backdrop-blur-sm px-2 py-1 rounded-full">
                          <Globe className="w-4 h-4 text-white" />
                          <span className="text-xs text-white">Public</span>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-1 bg-white/20 backdrop-blur-sm px-2 py-1 rounded-full">
                          <Lock className="w-4 h-4 text-white" />
                          <span className="text-xs text-white">Private</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-5">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {community.name}
                    </h3>
                    <p className="text-sm text-gray-500 mb-4">{community.type}</p>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1 text-sm text-gray-600">
                        <User className="w-4 h-4" />
                        <span>{community.members} members</span>
                      </div>
                      
                      {community.joined ? (
                        <button
                          onClick={() => handleLeaveCommunity(community.id)}
                          className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
                        >
                          Leave
                        </button>
                      ) : (
                        <button
                          onClick={() => handleJoinCommunity(community.id)}
                          className="flex items-center space-x-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                        >
                          <span>Join</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {filteredCommunities.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500">No communities found matching your search.</p>
              </div>
            )}
          </div>
        ) : (
          // Create Community Form
          <div className="max-w-3xl mx-auto">
            <button
              onClick={() => setView('list')}
              className="mb-6 text-blue-600 hover:text-blue-700 flex items-center space-x-2"
            >
              <span>← Back to Communities</span>
            </button>

            <div className="bg-white rounded-lg shadow-sm p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Create New Community</h2>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Community Template
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {templates.map(template => {
                      const Icon = template.icon;
                      return (
                        <button
                          key={template.id}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, type: template.id }))}
                          className={`p-4 rounded-lg border-2 transition-all ${
                            formData.type === template.id
                              ? `${template.color} border-transparent text-white`
                              : 'border-gray-200 hover:border-gray-300 text-gray-700'
                          }`}
                        >
                          <Icon className="w-8 h-8 mx-auto mb-2" />
                          <span className="text-sm font-medium">{template.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                    Community Name *
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="e.g., Tech Hostel Block A"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows={4}
                    placeholder="Brief description of your community..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-2">
                    Your Role *
                  </label>
                  <select
                    id="role"
                    name="role"
                    value={formData.role}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="Head">Head</option>
                    <option value="Admin">Admin</option>
                    <option value="Member">Member</option>
                  </select>
                </div>

                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="isPublic"
                    name="isPublic"
                    checked={formData.isPublic}
                    onChange={handleInputChange}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="isPublic" className="text-sm text-gray-700">
                    Make this community public (anyone can join)
                  </label>
                </div>

                <div className="flex space-x-4 pt-4">
                  <button
                    onClick={handleCreateCommunity}
                    className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition font-medium"
                  >
                    Create Community
                  </button>
                  <button
                    onClick={() => setView('list')}
                    className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default CommunityManager;
'use client';

import { useState } from 'react';
import { Users, Link2, Copy, Check, MessageSquare, Send, Shield, Eye, Edit3 } from 'lucide-react';
import toast from 'react-hot-toast';

interface Comment {
  id: string;
  author: string;
  text: string;
  bar: number | null;
  timestamp: string;
}

export default function CollaboratePage() {
  const [shareLink, setShareLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [comments, setComments] = useState<Comment[]>([
    { id: '1', author: 'You', text: 'Verse needs more energy', bar: 8, timestamp: '2 min ago' },
    { id: '2', author: 'You', text: 'Love the bass in the chorus', bar: 16, timestamp: '5 min ago' },
  ]);
  const [newComment, setNewComment] = useState('');
  const [collaborators, setCollaborators] = useState<{ name: string; role: string; status: string }[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer' | 'vocalist'>('editor');

  function generateLink() {
    const link = `${window.location.origin}/session/${Date.now().toString(36)}`;
    setShareLink(link);
  }

  function copyLink() {
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    toast.success('Link copied!');
    setTimeout(() => setCopied(false), 2000);
  }

  function addComment() {
    if (!newComment.trim()) return;
    setComments(prev => [{
      id: `c-${Date.now()}`,
      author: 'You',
      text: newComment,
      bar: null,
      timestamp: 'Just now',
    }, ...prev]);
    setNewComment('');
  }

  function inviteCollaborator() {
    if (!inviteEmail.trim()) return;
    setCollaborators(prev => [...prev, { name: inviteEmail, role: inviteRole, status: 'pending' }]);
    setInviteEmail('');
    toast.success(`Invite sent to ${inviteEmail}`);
  }

  const inputClass = 'w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-teal-500';

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <Users className="w-6 h-6 text-teal-500" />
          Collaborate
        </h1>
        <p className="text-gray-400 text-sm mt-1">Share projects, invite collaborators, leave feedback</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Share Project */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Link2 className="w-4 h-4 text-teal-500" /> Share Project
          </h2>
          {!shareLink ? (
            <button onClick={generateLink}
              className="w-full py-3 bg-teal-600 hover:bg-teal-700 rounded-lg text-sm font-medium text-white">
              Generate Share Link
            </button>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-2">
                <input type="text" value={shareLink} readOnly className={inputClass} />
                <button onClick={copyLink}
                  className="px-4 bg-teal-600 hover:bg-teal-700 rounded-lg text-sm text-white flex items-center gap-1">
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex gap-2">
                {[
                  { icon: Eye, label: 'View Only', desc: 'Can listen and comment' },
                  { icon: Edit3, label: 'Can Edit', desc: 'Full access to edit' },
                ].map(({ icon: Icon, label, desc }) => (
                  <button key={label} className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg p-3 text-left">
                    <Icon className="w-4 h-4 text-teal-500 mb-1" />
                    <p className="text-xs font-medium text-white">{label}</p>
                    <p className="text-[9px] text-gray-500">{desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Invite Collaborators */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4 text-teal-500" /> Invite Collaborators
          </h2>
          <div className="flex gap-2 mb-4">
            <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="Email address" className={`${inputClass} flex-1`} />
            <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as typeof inviteRole)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 text-sm text-white">
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
              <option value="vocalist">Vocalist</option>
            </select>
            <button onClick={inviteCollaborator}
              className="px-4 bg-teal-600 hover:bg-teal-700 rounded-lg text-sm text-white">
              Invite
            </button>
          </div>
          {collaborators.length > 0 ? (
            <div className="space-y-2">
              {collaborators.map((c, i) => (
                <div key={i} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2">
                  <div>
                    <p className="text-xs text-white">{c.name}</p>
                    <p className="text-[9px] text-gray-500">{c.role}</p>
                  </div>
                  <span className={`text-[9px] px-2 py-0.5 rounded-full ${c.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-teal-500/20 text-teal-400'}`}>
                    {c.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-600 text-center py-4">No collaborators yet</p>
          )}
        </div>

        {/* Comments */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-teal-500" /> Session Comments
          </h2>
          <div className="flex gap-2 mb-4">
            <input type="text" value={newComment} onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addComment()}
              placeholder="Leave a comment..." className={`${inputClass} flex-1`} />
            <button onClick={addComment} className="px-4 bg-teal-600 hover:bg-teal-700 rounded-lg text-white">
              <Send className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2 max-h-64 overflow-auto">
            {comments.map(c => (
              <div key={c.id} className="bg-white/5 rounded-lg px-3 py-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-teal-400 font-medium">{c.author}</span>
                  <div className="flex items-center gap-2">
                    {c.bar && <span className="text-[9px] text-gray-600">Bar {c.bar}</span>}
                    <span className="text-[9px] text-gray-600">{c.timestamp}</span>
                  </div>
                </div>
                <p className="text-xs text-gray-300">{c.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

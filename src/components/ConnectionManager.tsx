import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2, Edit3, Trophy, Clock, AlertTriangle, Wifi, WifiOff } from 'lucide-react';
import {
    type GameProfile,
    getProfiles,
    saveProfile,
    deleteProfile,
    getAutoRemoveDays,
    setAutoRemoveDays,
    pruneGoaledProfiles,
} from '../services/connectionManagerService';
import { useGame } from '../context/GameContext';

interface ConnectionManagerProps {
    isOpen: boolean;
    onClose: () => void;
    onConnect: (profile: GameProfile) => void;
}

const APWORLD_VERSION_LABELS: Record<string, string> = {
    new: 'New APWorld',
    legacy: 'Legacy APWorld',
    unknown: 'Unknown',
};

const emptyForm = (): Omit<GameProfile, 'id' | 'isGoaled'> => ({
    name: '',
    hostname: 'archipelago.gg',
    port: 38281,
    slotName: '',
    password: '',
});

export const ConnectionManager: React.FC<ConnectionManagerProps> = ({ isOpen, onClose, onConnect }) => {
    const { connectionInfo, isConnected, currentProfileId, disconnect } = useGame();

    const [profiles, setProfiles] = useState<GameProfile[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isAdding, setIsAdding] = useState(false);
    const [form, setForm] = useState(emptyForm());
    const [autoRemoveDays, setAutoRemoveDaysState] = useState(getAutoRemoveDays());
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

    const reload = useCallback(() => {
        setProfiles(getProfiles());
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        pruneGoaledProfiles();
        reload();
    }, [isOpen, reload]);

    const handleAutoRemoveChange = (days: number) => {
        setAutoRemoveDaysState(days);
        setAutoRemoveDays(days);
    };

    const handleSave = () => {
        if (!form.name.trim() || !form.slotName.trim()) return;
        const id = editingId ?? crypto.randomUUID();
        const existing = profiles.find(p => p.id === id);
        saveProfile({
            id,
            name: form.name.trim(),
            hostname: form.hostname.trim(),
            port: Number(form.port),
            slotName: form.slotName.trim(),
            password: form.password || undefined,
            isGoaled: existing?.isGoaled ?? false,
            goaledAt: existing?.goaledAt,
            lastConnected: existing?.lastConnected,
            apworldVersion: existing?.apworldVersion,
            goalCount: existing?.goalCount,
            activeRegionNames: existing?.activeRegionNames,
        });
        setEditingId(null);
        setIsAdding(false);
        reload();
    };

    const handleEdit = (profile: GameProfile) => {
        setEditingId(profile.id);
        setIsAdding(false);
        setForm({
            name: profile.name,
            hostname: profile.hostname,
            port: profile.port,
            slotName: profile.slotName,
            password: profile.password || '',
        });
    };

    const handleAdd = () => {
        setIsAdding(true);
        setEditingId(null);
        setForm({
            ...emptyForm(),
            hostname: connectionInfo.hostname,
            port: connectionInfo.port,
            slotName: connectionInfo.slotName,
        });
    };

    const handleCancel = () => {
        setEditingId(null);
        setIsAdding(false);
    };

    const handleConnect = (profile: GameProfile) => {
        onConnect(profile);
        onClose();
    };

    const handleDelete = (id: string) => {
        if (deleteConfirmId === id) {
            deleteProfile(id);
            setDeleteConfirmId(null);
            reload();
        } else {
            setDeleteConfirmId(id);
        }
    };

    const formatRelative = (ts?: number) => {
        if (!ts) return null;
        const diff = Date.now() - ts;
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'just now';
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        return `${Math.floor(hrs / 24)}d ago`;
    };

    const autoRemoveIn = (profile: GameProfile) => {
        if (!profile.isGoaled || !profile.goaledAt) return null;
        const cutoff = profile.goaledAt + autoRemoveDays * 24 * 60 * 60 * 1000;
        const remaining = cutoff - Date.now();
        if (remaining <= 0) return 'soon';
        const hrs = Math.floor(remaining / 3600000);
        if (hrs < 24) return `${hrs}h`;
        return `${Math.floor(hrs / 24)}d`;
    };

    if (!isOpen) return null;

    const showForm = isAdding || editingId !== null;

    return createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl border border-gray-800 flex flex-col max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-950/60 shrink-0">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <Wifi size={18} className="text-blue-400" />
                        Manage Games
                    </h2>
                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 text-[10px] text-gray-500">
                            <span>Auto-remove goaled after</span>
                            <select
                                value={autoRemoveDays}
                                onChange={e => handleAutoRemoveChange(Number(e.target.value))}
                                className="bg-gray-800 border border-gray-700 rounded px-1 py-0.5 text-[10px] text-gray-300 outline-none"
                            >
                                {[1, 2, 3, 5, 7, 14, 30].map(d => (
                                    <option key={d} value={d}>{d} {d === 1 ? 'day' : 'days'}</option>
                                ))}
                            </select>
                        </label>
                        <button onClick={onClose} className="p-1.5 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors">
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
                    {/* Profile list */}
                    {profiles.length === 0 && !showForm && (
                        <div className="text-center py-12 text-gray-600 text-sm">
                            No saved games yet. Add one below!
                        </div>
                    )}

                    {profiles.map(profile => {
                        const isEditingThis = editingId === profile.id;
                        const removeIn = autoRemoveIn(profile);
                        const isActiveProfile = isConnected && currentProfileId === profile.id;

                        if (isEditingThis) {
                            return (
                                <ProfileForm
                                    key={profile.id}
                                    form={form}
                                    setForm={setForm}
                                    onSave={handleSave}
                                    onCancel={handleCancel}
                                    isEditing
                                />
                            );
                        }

                        return (
                            <div
                                key={profile.id}
                                className={`border rounded-xl p-4 flex flex-col gap-2 ${isActiveProfile ? 'border-green-700/50 bg-green-900/5' : profile.isGoaled ? 'border-yellow-700/40 bg-yellow-900/5' : 'border-gray-800 bg-gray-800/20'}`}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-bold text-sm text-white">{profile.name}</span>
                                            {isActiveProfile && (
                                                <span className="flex items-center gap-1 text-[10px] text-green-400 bg-green-900/20 border border-green-700/30 px-1.5 py-0.5 rounded">
                                                    <Wifi size={9} />
                                                    Connected
                                                </span>
                                            )}
                                            {profile.isGoaled && (
                                                <span className="flex items-center gap-1 text-[10px] text-yellow-400 bg-yellow-900/20 border border-yellow-700/30 px-1.5 py-0.5 rounded">
                                                    <Trophy size={10} />
                                                    Goaled
                                                    {removeIn && <span className="text-yellow-600">· removes in {removeIn}</span>}
                                                </span>
                                            )}
                                            {profile.apworldVersion && profile.apworldVersion !== 'unknown' && (
                                                <span className={`text-[9px] px-1.5 py-0.5 rounded border ${profile.apworldVersion === 'new' ? 'text-green-400 bg-green-900/10 border-green-800/30' : 'text-orange-400 bg-orange-900/10 border-orange-800/30'}`}>
                                                    {APWORLD_VERSION_LABELS[profile.apworldVersion]}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-[11px] text-gray-500 mt-0.5">
                                            {profile.hostname}:{profile.port} · {profile.slotName}
                                        </div>
                                        <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-600 flex-wrap">
                                            {profile.lastKnownCaught !== undefined && profile.goalCount !== undefined && (
                                                <span>{profile.lastKnownCaught}/{profile.goalCount} caught</span>
                                            )}
                                            {profile.activeRegionNames && profile.activeRegionNames.length > 0 && (
                                                <span>{profile.activeRegionNames.join(', ')}</span>
                                            )}
                                            {profile.lastConnected ? (
                                                <span className="flex items-center gap-0.5"><Clock size={9} /> {formatRelative(profile.lastConnected)}</span>
                                            ) : (
                                                <span className="text-gray-700 italic">Never connected</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        {isActiveProfile ? (
                                            <button
                                                onClick={() => { disconnect(); onClose(); }}
                                                className="flex items-center gap-1 px-3 py-1.5 bg-red-900/40 hover:bg-red-900/60 text-red-300 border border-red-800/40 rounded-lg text-xs font-bold transition-colors"
                                            >
                                                <WifiOff size={12} />
                                                Disconnect
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => handleConnect(profile)}
                                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-colors"
                                            >
                                                Connect
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleEdit(profile)}
                                            className="p-1.5 text-gray-500 hover:text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
                                            title="Edit"
                                        >
                                            <Edit3 size={14} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(profile.id)}
                                            className={`p-1.5 rounded-lg transition-colors ${deleteConfirmId === profile.id ? 'text-red-400 bg-red-900/20 border border-red-700/40' : 'text-gray-600 hover:text-red-400 hover:bg-gray-800'}`}
                                            title={deleteConfirmId === profile.id ? 'Click again to confirm' : 'Delete'}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                                {deleteConfirmId === profile.id && (
                                    <div className="flex items-center gap-2 text-[10px] text-red-400 bg-red-900/10 border border-red-900/20 rounded px-2 py-1.5">
                                        <AlertTriangle size={11} />
                                        Click the delete button again to confirm removal.
                                        <button onClick={() => setDeleteConfirmId(null)} className="ml-auto text-gray-500 hover:text-gray-300 underline">Cancel</button>
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* Add form */}
                    {isAdding && (
                        <ProfileForm
                            form={form}
                            setForm={setForm}
                            onSave={handleSave}
                            onCancel={handleCancel}
                            isEditing={false}
                        />
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-3 border-t border-gray-800 shrink-0 flex justify-between items-center bg-gray-950/40">
                    {!showForm ? (
                        <button
                            onClick={handleAdd}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-lg text-xs font-bold transition-colors"
                        >
                            <Plus size={14} />
                            Add Game
                        </button>
                    ) : (
                        <div />
                    )}
                    <button onClick={onClose} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-bold transition-colors border border-gray-700">
                        Close
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

interface ProfileFormProps {
    form: ReturnType<typeof emptyForm>;
    setForm: React.Dispatch<React.SetStateAction<ReturnType<typeof emptyForm>>>;
    onSave: () => void;
    onCancel: () => void;
    isEditing: boolean;
}

const ProfileForm: React.FC<ProfileFormProps> = ({ form, setForm, onSave, onCancel, isEditing }) => {
    const update = (patch: Partial<typeof form>) => setForm(prev => ({ ...prev, ...patch }));
    const valid = form.name.trim() && form.slotName.trim();

    return (
        <div className="border border-blue-700/30 bg-blue-900/5 rounded-xl p-4 space-y-3">
            <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider">{isEditing ? 'Edit Game' : 'Add Game'}</h4>
            <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                    <label className="block text-[10px] text-gray-400 mb-1">Display Name</label>
                    <input
                        type="text"
                        value={form.name}
                        onChange={e => update({ name: e.target.value })}
                        placeholder="My Archipelago Game"
                        className="w-full px-2 py-1.5 bg-gray-950 border border-gray-700 rounded text-xs text-white outline-none focus:border-blue-500"
                    />
                </div>
                <div>
                    <label className="block text-[10px] text-gray-400 mb-1">Server</label>
                    <input
                        type="text"
                        value={form.hostname}
                        onChange={e => update({ hostname: e.target.value })}
                        className="w-full px-2 py-1.5 bg-gray-950 border border-gray-700 rounded text-xs text-white outline-none focus:border-blue-500"
                    />
                </div>
                <div>
                    <label className="block text-[10px] text-gray-400 mb-1">Port</label>
                    <input
                        type="number"
                        value={form.port}
                        onChange={e => update({ port: Number(e.target.value) })}
                        className="w-full px-2 py-1.5 bg-gray-950 border border-gray-700 rounded text-xs text-white outline-none focus:border-blue-500"
                    />
                </div>
                <div>
                    <label className="block text-[10px] text-gray-400 mb-1">Slot Name</label>
                    <input
                        type="text"
                        value={form.slotName}
                        onChange={e => update({ slotName: e.target.value })}
                        className="w-full px-2 py-1.5 bg-gray-950 border border-gray-700 rounded text-xs text-white outline-none focus:border-blue-500"
                    />
                </div>
                <div>
                    <label className="block text-[10px] text-gray-400 mb-1">Password (optional)</label>
                    <input
                        type="password"
                        value={form.password || ''}
                        onChange={e => update({ password: e.target.value })}
                        className="w-full px-2 py-1.5 bg-gray-950 border border-gray-700 rounded text-xs text-white outline-none focus:border-blue-500"
                    />
                </div>
            </div>
            {form.password && (
                <div className="flex items-start gap-1.5 text-[10px] text-yellow-600 bg-yellow-900/10 border border-yellow-800/30 rounded px-2 py-1.5">
                    <AlertTriangle size={11} className="mt-0.5 shrink-0" />
                    Password stored in plaintext in browser localStorage. Use with care.
                </div>
            )}
            <div className="flex gap-2 justify-end">
                <button onClick={onCancel} className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded text-xs transition-colors border border-gray-700">
                    Cancel
                </button>
                <button
                    onClick={onSave}
                    disabled={!valid}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900/40 disabled:text-gray-500 text-white rounded text-xs font-bold transition-colors"
                >
                    Save
                </button>
            </div>
        </div>
    );
};

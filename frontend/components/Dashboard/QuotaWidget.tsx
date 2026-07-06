'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Sparkles, Shield, Zap, Loader, Check } from 'lucide-react';
import API from '../../lib/api';
import { toast } from '../../hooks/useToast';

interface QuotaDetails {
	max_tasks: number;
	max_ai_requests_per_day: number;
	max_calendar_connections: number;
}

interface SubscriptionStatus {
	plan: string;
	subscription_expires_at: string | null;
	is_expired: boolean;
	quota: QuotaDetails;
}

interface QuotaWidgetProps {
	onPlanUpgraded?: () => void;
}

export default function QuotaWidget({ onPlanUpgraded }: QuotaWidgetProps) {
	const [status, setStatus] = useState<SubscriptionStatus | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isUpgrading, setIsUpgrading] = useState(false);

	const fetchStatus = useCallback(async () => {
		try {
			const res = await API.get('/subscription/status');
			setStatus(res.data?.data);
		} catch (err) {
			console.error('Gagal memuat status langganan:', err);
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchStatus();
	}, [fetchStatus]);

	const handleUpgrade = async () => {
		if (isUpgrading) return;
		setIsUpgrading(true);

		try {
			const res = await API.post('/subscription/upgrade', { plan: 'pro' });
			toast.success(res.data?.data?.message || 'Selamat! Akun Anda berhasil di-upgrade ke PRO!');
			await fetchStatus();
			if (onPlanUpgraded) onPlanUpgraded();
		} catch (err: any) {
			toast.error(err.response?.data?.error || 'Gagal melakukan upgrade.');
		} finally {
			setIsUpgrading(false);
		}
	};

	if (isLoading) {
		return (
			<div className="bg-white border-3 border-black rounded-2xl shadow-[4px_4px_0px_0px_#000] p-4 flex items-center justify-center h-28">
				<Loader className="w-6 h-6 animate-spin text-neoViolet" />
			</div>
		);
	}

	if (!status) return null;

	const isPro = status.plan === 'pro';

	return (
		<div className="bg-white border-3 border-black rounded-2xl shadow-[4px_4px_0px_0px_#000] p-4 flex flex-col justify-between relative overflow-hidden transition-all hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[5px_5px_0px_0px_#000]">
			{/* Accent Glow */}
			<div 
				className="absolute -right-8 -top-8 w-20 h-20 rounded-full opacity-20 pointer-events-none" 
				style={{ 
					background: isPro 
						? 'radial-gradient(circle, #8B5CF6 0%, transparent 70%)' 
						: 'radial-gradient(circle, #FBBF24 0%, transparent 70%)' 
				}} 
			/>

			<div className="space-y-3">
				{/* Top Row */}
				<div className="flex justify-between items-center">
					<span className="text-[10px] font-black uppercase tracking-wider text-black/60">Status Akun</span>
					<span 
						className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border-2 border-black shadow-[1.5px_1.5px_0px_0px_#000] ${
							isPro ? 'bg-neoViolet text-white' : 'bg-neoYellow text-black'
						}`}
					>
						{isPro ? 'PRO PLAN' : 'FREE PLAN'}
					</span>
				</div>

				{/* Description */}
				<div className="space-y-1.5 text-left">
					<h4 className="text-sm font-black text-black flex items-center gap-1">
						{isPro ? (
							<>
								<Shield className="w-4.5 h-4.5 text-neoViolet fill-neoViolet/10" />
								Akses Tidak Terbatas
							</>
						) : (
							<>
								<Zap className="w-4.5 h-4.5 text-neoYellow fill-neoYellow/10" />
								Batas Kuota Aktif
							</>
						)}
					</h4>
					<p className="text-[10px] font-extrabold text-black/65 leading-relaxed">
						{isPro ? (
							'Semua fitur premium aktif. AI Auto-Scheduler & ekspor dokumen tanpa batas.'
						) : (
							`Maksimal ${status.quota.max_tasks} tugas, ${status.quota.max_ai_requests_per_day} chat AI harian, & ${status.quota.max_calendar_connections} kalender.`
						)}
					</p>
				</div>
			</div>

			{/* Upgrade Button */}
			{!isPro && (
				<button
					type="button"
					onClick={handleUpgrade}
					disabled={isUpgrading}
					className="w-full mt-3 bg-neoYellow border-2 border-black text-black text-xs font-black py-2 rounded-xl shadow-[2px_2px_0px_0px_#000] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
				>
					{isUpgrading ? (
						<>
							<Loader className="w-3.5 h-3.5 animate-spin" />
							Memproses...
						</>
					) : (
						<>
							<Sparkles className="w-3.5 h-3.5 fill-current animate-pulse" />
							UPGRADE KE PRO (FREE)
						</>
					)}
				</button>
			)}

			{isPro && (
				<div className="w-full mt-3 bg-neoMint/20 border-2 border-black text-black text-[10px] font-black py-2 rounded-xl flex items-center justify-center gap-1.5">
					<Check className="w-3.5 h-3.5 text-black stroke-[3]" />
					<span>Sesi Pro Aktif</span>
				</div>
			)}
		</div>
	);
}

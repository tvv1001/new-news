'use client';

import { useEffect, useState } from 'react';
import {
	addContextSource,
	blockContextSource,
	fetchContextMonitor,
	fetchContextPortal,
	removeContextSource,
	testContextSource,
	unblockContextSource,
	updateContextSource,
} from '../../api';
import '../../style.css';

export default function SSEDashboardPage() {
	const [portal, setPortal] = useState<any>(null);
	const [loading, setLoading] = useState(true);
	const [editingSource, setEditingSource] = useState<any>(null);
	const [testingPreview, setTestingPreview] = useState<any>(null);
	const [form, setForm] = useState({
		url: '',
		source: '',
		context: 'news',
		useTagTemplate: false,
		replaceTagValue: '',
		testTag: '',
	});

	const load = async (force = false) => {
		try {
			if (force) await fetchContextMonitor({ refresh: true });
			const nextPortal = await fetchContextPortal();
			setPortal(nextPortal || {});
		} catch (error) {
			console.error(error);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		void load();
		const id = setInterval(() => {
			fetchContextPortal()
				.then((nextPortal) => setPortal(nextPortal || {}))
				.catch(console.error);
		}, 60000);

		return () => {
			clearInterval(id);
		};
	}, []);

	const builtin = Array.isArray(portal?.catalog) ? portal.catalog : [];
	const liveMatches = Array.isArray(portal?.output?.matches) ? portal.output.matches : [];

	const resetForm = () =>
		setForm({
			url: '',
			source: '',
			context: 'news',
			useTagTemplate: false,
			replaceTagValue: '',
			testTag: '',
		});

	const handleTest = async () => {
		if (!form.url) return;
		setTestingPreview(null);
		try {
			const preview = await testContextSource({
				url: form.url,
				useTagTemplate: form.useTagTemplate,
				urlTemplate: form.useTagTemplate ? form.url : undefined,
				replaceTagValue: form.replaceTagValue,
				testTag: form.testTag,
				sampleTag: form.testTag,
			});
			setTestingPreview(preview);
		} catch (error: any) {
			setTestingPreview({ error: error.message || String(error) });
		}
	};

	const handleSubmit = async (event: any) => {
		event?.preventDefault();
		try {
			if (editingSource) {
				await updateContextSource(editingSource.url || editingSource, { ...editingSource, ...form });
			} else {
				await addContextSource({ ...form });
			}
			resetForm();
			setEditingSource(null);
			await load(true);
		} catch (error: any) {
			alert(error.message || 'Failed to save source');
		}
	};

	const handleEdit = (source: any) => {
		setEditingSource(source);
		setForm({
			url: source.url || '',
			source: source.source || '',
			context: source.context || 'news',
			useTagTemplate: !!source.urlTemplate,
			replaceTagValue: source.replaceTagValue || '',
			testTag: '',
		});
	};

	const handleRemove = async (url: string, isCustom = false) => {
		try {
			if (isCustom) await removeContextSource(url);
			else await blockContextSource(url);
			await load(true);
		} catch (error: any) {
			alert(error.message || 'Failed to remove');
		}
	};

	const handleUnblock = async (url: string) => {
		try {
			await unblockContextSource(url);
			await load(true);
		} catch (error: any) {
			alert(error.message || 'Failed to unblock');
		}
	};

	if (loading) return <div className='portal-loading'>Loading SSE Dashboard...</div>;

	return (
		<div className='dark-route-shell portal-dark-shell'>
			<div
				className='portal-two-column'
				style={{ display: 'flex', gap: 16 }}>
				<div
					className='portal-column'
					style={{ flex: 1 }}>
					<section className='panel portal-card'>
						<h3>Status & Config (Tag Stream)</h3>
						<div>Started: {portal?.status?.started ? 'yes' : 'no'}</div>
						<div>Stream version: {portal?.status?.streamVersion}</div>
						<div>Feeds: {portal?.status?.feedCount}</div>
						<div>Live matches: {liveMatches.length}</div>
					</section>

					<section className='panel portal-card'>
						<h3>Add / Edit Tag Feed Source</h3>
						<form
							onSubmit={handleSubmit}
							className='form-grid'>
							<div className='form-field full-width'>
								<label>URL or Template</label>
								<input
									type='url'
									value={form.url}
									onChange={(event) => setForm((state) => ({ ...state, url: event.target.value }))}
									required
								/>
							</div>
							<div className='form-field'>
								<label>Source name</label>
								<input
									value={form.source}
									onChange={(event) => setForm((state) => ({ ...state, source: event.target.value }))}
								/>
							</div>
							<div className='form-actions'>
								<button
									className='btn btn-secondary'
									type='button'
									onClick={handleTest}>
									Test
								</button>
								<button
									className='btn btn-primary'
									type='submit'>
									{editingSource ? 'Update' : 'Add'}
								</button>
							</div>
						</form>
						{testingPreview && (
							<div className='portal-test-preview'>
								{testingPreview.error ?
									<div className='portal-test-error'>{testingPreview.error}</div>
								:	<div>
										<strong>{testingPreview.title}</strong>
										<div>{testingPreview.itemCount} items</div>
									</div>
								}
							</div>
						)}
					</section>

					<section className='panel portal-card portal-sources'>
						<h3>Builtin Catalog</h3>
						<div className='portal-list'>
							{builtin.slice(0, 20).map((feed: any, index: number) => (
								<div
									key={`${feed.url || feed.source}-${index}`}
									className='portal-list-item'>
									<div className='portal-item-main'>
										<div className='portal-item-title'>{feed.source}</div>
										<div className='portal-item-url'>{feed.url || feed.homepage || ''}</div>
									</div>
									<div className='portal-item-actions'>
										<button
											className='btn btn-remove'
											onClick={() => handleRemove(feed.url || feed.homepage, false)}>
											Remove
										</button>
									</div>
								</div>
							))}
						</div>
					</section>

					<section className='panel portal-card'>
						<h3>Catalog</h3>
						{(() => {
							const portalUserAdded = Array.isArray(portal?.sources?.userAdded) ? portal.sources.userAdded : [];
							const templateBaseUrls = portalUserAdded.filter((feed: any) => feed.type === 'tag-template');
							const tagDrivenFeeds = Array.isArray(portal?.catalog) ? portal.catalog.filter((feed: any) => String(feed?.urlTemplate || feed?.parentUrl || '').trim()) : [];
							const standardCatalogFeeds = Array.isArray(portal?.catalog) ? portal.catalog.filter((feed: any) => !String(feed?.urlTemplate || feed?.parentUrl || '').trim()) : [];

							return (
								<div>
									{templateBaseUrls.length > 0 && (
										<div className='portal-list portal-list-large'>
											{templateBaseUrls.map((feed: any, index: number) => (
												<div
													key={`template-${index}`}
													className='portal-list-item'>
													<div className='portal-item-main'>
														<div className='portal-item-url'>{`Base URL: ${feed.url}`}</div>
													</div>
													<div className='portal-item-actions'>
														<button
															className='btn btn-secondary'
															onClick={() => handleEdit(feed)}>
															Edit
														</button>
														<button
															className='btn btn-remove'
															onClick={() => handleRemove(feed.url, true)}>
															Remove
														</button>
													</div>
												</div>
											))}
										</div>
									)}

									{tagDrivenFeeds.length > 0 && (
										<div className='portal-list portal-list-large'>
											{tagDrivenFeeds.map((feed: any, index: number) => (
												<div
													key={`tag-driven-${index}`}
													className='portal-list-item'>
													<div className='portal-item-main'>
														<div className='portal-item-title'>{feed.source}</div>
														<div className='portal-item-url'>{feed.url || feed.parentUrl}</div>
													</div>
													<div className='portal-item-actions'>
														<button
															className='btn btn-secondary'
															onClick={() => handleEdit(feed)}>
															Edit
														</button>
														<button
															className='btn btn-remove'
															onClick={() => handleRemove(feed.url, false)}>
															Remove
														</button>
													</div>
												</div>
											))}
										</div>
									)}

									{standardCatalogFeeds.length > 0 && (
										<div className='portal-list portal-list-large'>
											{standardCatalogFeeds.map((feed: any, index: number) => (
												<div
													key={`standard-${index}`}
													className='portal-list-item'>
													<div className='portal-item-main'>
														<div className='portal-item-title'>{feed.source}</div>
														<div className='portal-item-url'>{feed.url}</div>
													</div>
													<div className='portal-item-actions'>
														<button
															className='btn btn-secondary'
															onClick={() => handleEdit(feed)}>
															Edit
														</button>
														<button
															className='btn btn-remove'
															onClick={() => handleRemove(feed.url, false)}>
															Remove
														</button>
													</div>
												</div>
											))}
										</div>
									)}

									{Array.isArray(portal?.sources?.blocked) && portal.sources.blocked.length > 0 && (
										<div>
											<h4>Blocked Sources</h4>
											<div className='portal-list'>
												{portal.sources.blocked.map((url: string, index: number) => (
													<div
														key={`blocked-left-${index}`}
														className='portal-list-item'>
														<div className='portal-item-main'>
															<div className='portal-item-url'>{url}</div>
														</div>
														<div className='portal-item-actions'>
															<button
																className='btn btn-secondary'
																onClick={() => handleUnblock(url)}>
																Unblock
															</button>
														</div>
													</div>
												))}
											</div>
										</div>
									)}

									<div style={{ marginTop: 12 }}>
										<strong>Tag Feed RSS Output</strong>
										<div>
											<code className='portal-url-code'>http://localhost:3001/api/context/rss</code>
										</div>
									</div>
								</div>
							);
						})()}
					</section>

					<section className='panel portal-card'>
						<h3>Live Tag Stream Preview</h3>
						<div>{liveMatches.length ? `${liveMatches.length} matching items currently buffered.` : 'No matching items buffered yet.'}</div>
					</section>
				</div>
			</div>
		</div>
	);
}

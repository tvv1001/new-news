'use client';

import { useEffect, useState } from 'react';
import { addContextSource, blockContextSource, fetchContextMonitor, fetchContextPortal, removeContextSource, testContextSource, updateContextSource } from '../../api';
import useBodyClass from '../../hooks/useBodyClass';
import '../../style.css';

export default function SSEDashboardPage() {
	useBodyClass('sse-dashboard-page');
	const [portal, setPortal] = useState<any>(null);
	const [loading, setLoading] = useState(true);
	const [editingSource, setEditingSource] = useState<any>(null);
	const [testingPreview, setTestingPreview] = useState<any>(null);
	const [form, setForm] = useState({
		url: '',
		source: '',
		context: 'news',
	});

	const load = async (force = false) => {
		try {
			if (force) await fetchContextMonitor({ refresh: true });
			const nextPortal = await fetchContextPortal();
			setPortal(nextPortal || {});
			// No UI test tag; we read active tag from portal when needed
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

	const portalUserAdded = Array.isArray(portal?.sources?.userAdded) ? portal.sources.userAdded : [];
	const userSourceUrls = new Set(portalUserAdded.map((feed: any) => String(feed?.url || feed?.parentUrl || '').trim()).filter(Boolean));
	const catalog = Array.isArray(portal?.catalog) ? portal.catalog : [];
	const builtinCatalogFeeds = catalog.filter((feed: any) => !userSourceUrls.has(String(feed?.url || feed?.parentUrl || '').trim()));
	const liveMatches = Array.isArray(portal?.output?.matches) ? portal.output.matches : [];

	const activeTag = portal?.tags && portal.tags.length ? portal.tags[0] : '';
	const builtinTemplateFeeds = builtinCatalogFeeds.filter((feed: any) => String(feed?.url || '').includes('{TAG}') || feed.type === 'tag-template');

	const resetForm = () =>
		setForm({
			url: '',
			source: '',
			context: 'news',
		});

	const handleTest = async () => {
		if (!form.url) return;
		setTestingPreview(null);
		try {
			const activeTag = portal?.tags && portal.tags.length ? portal.tags[0] : '';
			const preview = await testContextSource({
				url: form.url,
				testTag: activeTag,
			});
			setTestingPreview(preview);
		} catch (error: any) {
			setTestingPreview({ error: error.message || String(error) });
		}
	};

	const handleSubmit = async (event: any) => {
		event?.preventDefault();
		try {
			const activeTag = portal?.tags && portal.tags.length ? portal.tags[0] : '';
			if (editingSource) {
				await updateContextSource(editingSource.url || editingSource, { ...editingSource, ...form, testTag: activeTag });
			} else {
				await addContextSource({ ...form, testTag: activeTag });
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

	if (loading) return <div className='portal-loading'>Loading SSE Dashboard...</div>;

	return (
		<div className='dark-route-shell portal-dark-shell'>
			<div
				className='portal-two-column'
				style={{ display: 'flex', gap: 16 }}>
				<div
					className='portal-column'
					style={{ flex: 1 }}>
					<div style={{ marginTop: 12 }}>
						<strong>Tag Feed RSS Output</strong>
						<div>
							<a
								className='portal-url-code'
								href='http://localhost:3001/api/context/rss'
								target='_blank'
								rel='noopener noreferrer'>
								http://localhost:3001/api/context/rss
							</a>
						</div>
					</div>

					<section className='panel portal-card'>
						<h3>Add / Edit Feed Source</h3>
						<form
							onSubmit={handleSubmit}
							className='form-grid'>
							<div className='form-field full-width'>
								<label>URL or URL template</label>
								<input
									type='text'
									value={form.url}
									onChange={(event) => setForm((state) => ({ ...state, url: event.target.value }))}
									placeholder='https://example.com/search?q={TAG}'
									required
								/>
								<small>
									Use <code>{'{TAG}'}</code> in the URL and actual feed tags will be substituted at runtime.
								</small>
							</div>
							{/* Test Tag is auto-supplied from the active portal tag; hidden from the UI */}
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

					<section className='panel portal-card'>
						<h3>User Sources</h3>
						<div className='portal-list portal-list-large'>
							{portalUserAdded.map((feed: any, index: number) => (
								<div
									key={`user-${index}`}
									className='portal-list-item'>
									<div className='portal-item-main'>
										<div className='portal-item-title'>{feed.source || '(Unnamed Source)'}</div>
										<div className='portal-item-url'>{feed.url || feed.homepage || feed.urlTemplate || ''}</div>
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
					</section>

					<section className='panel portal-card'>
						<h3>Catalog</h3>
						{(() => {
							const templateBaseUrls = portalUserAdded.filter((feed: any) => feed.type === 'tag-template');
							const standardCatalogFeeds = builtinCatalogFeeds.filter((feed: any) => !String(feed?.urlTemplate || feed?.parentUrl || '').trim());

							return (
								<div>
									{templateBaseUrls.length > 0 && (
										<div className='portal-list portal-list-large'>
											{templateBaseUrls.map((feed: any, index: number) => (
												<div
													key={`template-${index}`}
													className='portal-list-item'>
													<div className='portal-item-main'>
														<div className='portal-item-url'>
															{(() => {
																const activeTag = portal?.tags && portal.tags.length ? portal.tags[0] : 'all-news';
																const displayUrl = String(feed.url || '');
																const substituted = displayUrl.includes('{TAG}') ? displayUrl.replace(/\{TAG\}/g, encodeURIComponent(activeTag)) : displayUrl;
																return (
																	<a
																		href={substituted}
																		target='_blank'
																		rel='noopener noreferrer'>
																		{substituted}
																	</a>
																);
															})()}
														</div>
													</div>
												</div>
											))}
										</div>
									)}

									{builtinTemplateFeeds.length > 0 && (
										<div className='portal-list portal-list-large'>
											{builtinTemplateFeeds.map((feed: any, index: number) => (
												<div
													key={`builtin-template-${index}`}
													className='portal-list-item'>
													<div className='portal-item-main'>
														<div className='portal-item-title'>{feed.source || '(Template)'}</div>
														<div className='portal-item-url'>
															{(() => {
																const tag = activeTag || 'ebola';
																const display =
																	String(feed.url || '').includes('{TAG}') ? String(feed.url || '').replace(/\{TAG\}/gi, encodeURIComponent(tag)) : String(feed.url || '');
																return (
																	<a
																		href={display}
																		target='_blank'
																		rel='noopener noreferrer'>
																		{display}
																	</a>
																);
															})()}
														</div>
													</div>
													<div className='portal-item-actions'>
														<button
															className='btn btn-primary'
															onClick={async () => {
																try {
																	const tag = activeTag || 'ebola';
																	const newUrl = String(feed.url || '').replace(/\{TAG\}/gi, encodeURIComponent(tag));
																	await addContextSource({ url: newUrl, source: `${feed.source || 'Template'} · ${tag}`, context: 'news', testTag: tag });
																	await load(true);
																} catch (err: any) {
																	alert(err?.message || 'Failed to add template for tag');
																}
															}}>
															Add for current tag
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
												</div>
											))}
										</div>
									)}
								</div>
							);
						})()}
					</section>
				</div>
			</div>
		</div>
	);
}

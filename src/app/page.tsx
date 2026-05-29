'use client';

import App from '../components/App';
import useBodyClass from '../hooks/useBodyClass';

export default function Home() {
	useBodyClass('home-page');

	return (
		<div className='dark-route-shell home-dark-shell'>
			<App />
		</div>
	);
}

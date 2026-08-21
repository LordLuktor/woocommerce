/**
 * External dependencies
 */
import { speak } from '@wordpress/a11y';
import { BaseControl, Button } from '@wordpress/components';
import { createElement, useEffect, useRef, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import type { ReactNode } from 'react';

/**
 * Internal dependencies
 */
import { toCanonicalNumberValue } from './values';

export type NumberSpinControlProps = {
	id: string;
	label?: string;
	help?: ReactNode;
	value: string;
	placeholder?: string;
	disabled?: boolean;
	integerOnly?: boolean;
	onChange: ( next: number | null ) => void;
	inputAttributes?: Record< string, string | number | boolean >;
};

const plusIcon = (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 24 24"
		width="24"
		height="24"
		aria-hidden="true"
		focusable="false"
	>
		<path d="M11 12.5V17.5H12.5V12.5H17.5V11H12.5V6H11V11H6V12.5H11Z" />
	</svg>
);

const minusIcon = (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 24 24"
		width="24"
		height="24"
		aria-hidden="true"
		focusable="false"
	>
		<path d="M7 11.25h10v1.5H7z" />
	</svg>
);

const toFiniteNumber = ( raw: unknown ): number | undefined => {
	if ( typeof raw === 'number' && Number.isFinite( raw ) ) {
		return raw;
	}

	if ( typeof raw === 'string' && raw.trim() !== '' ) {
		const parsed = Number( raw );

		if ( Number.isFinite( parsed ) ) {
			return parsed;
		}
	}

	return undefined;
};

const decimalPlaces = ( value: number ) => {
	const normalized = String( value ).toLowerCase();

	if ( normalized.includes( 'e-' ) ) {
		const [ coefficient, exponent ] = normalized.split( 'e-' );
		const coefficientDecimals = coefficient.split( '.' )[ 1 ]?.length ?? 0;
		return Number( exponent ) + coefficientDecimals;
	}

	const fraction = normalized.split( '.' )[ 1 ];
	return fraction ? fraction.length : 0;
};

const stepDecimals = ( ...values: number[] ) =>
	Math.max( ...values.map( decimalPlaces ) );

const MAX_TO_FIXED_PRECISION = 100;

/**
 * A number input with explicit +/- spin buttons, per the settings designs.
 *
 * Composed from stable @wordpress/components APIs only; the native browser
 * spinner is hidden via CSS and stepping is handled by the buttons, while
 * typing and keyboard arrows keep the native input behavior.
 */
export const NumberSpinControl = ( {
	id,
	label,
	help,
	value,
	placeholder,
	disabled,
	integerOnly = false,
	onChange,
	inputAttributes,
}: NumberSpinControlProps ) => {
	const [ draftValue, setDraftValue ] = useState( value );
	const [ error, setError ] = useState< string | undefined >();
	const inputRef = useRef< HTMLInputElement >( null );

	useEffect( () => {
		setDraftValue( value );
		setError( undefined );
		inputRef.current?.setCustomValidity( '' );
	}, [ value ] );

	const min = toFiniteNumber( inputAttributes?.min );
	const max = toFiniteNumber( inputAttributes?.max );
	const parsedStep = toFiniteNumber( inputAttributes?.step );
	// A zero or negative step would make the buttons no-ops or invert them;
	// fall back to 1 like the native number input does for an invalid step.
	const step =
		typeof parsedStep === 'number' && parsedStep > 0 ? parsedStep : 1;
	const current = toCanonicalNumberValue( draftValue, integerOnly );
	const errorId = `${ id }__error`;
	const describedBy = [
		help ? `${ id }__help` : undefined,
		error ? errorId : undefined,
	]
		.filter( Boolean )
		.join( ' ' );

	const showInvalidValueError = () => {
		const message = integerOnly
			? __( 'Enter a valid whole number.', 'woocommerce' )
			: __( 'Enter a valid number.', 'woocommerce' );

		setError( message );
		inputRef.current?.setCustomValidity( message );
	};

	const commitDraft = () => {
		if ( draftValue.trim() === '' ) {
			setDraftValue( '' );
			setError( undefined );
			inputRef.current?.setCustomValidity( '' );
			onChange( null );
			return;
		}

		if ( current === null ) {
			showInvalidValueError();
			return;
		}

		setDraftValue( String( current ) );
		setError( undefined );
		inputRef.current?.setCustomValidity( '' );
		onChange( current );
	};

	const stepBy = ( direction: 1 | -1 ) => {
		if ( draftValue.trim() !== '' && current === null ) {
			showInvalidValueError();
			return;
		}

		let next = ( current ?? 0 ) + direction * step;

		if ( typeof min !== 'undefined' ) {
			next = Math.max( min, next );
		}

		if ( typeof max !== 'undefined' ) {
			next = Math.min( max, next );
		}

		const requiredPrecision = stepDecimals(
			step,
			current ?? 0,
			min ?? 0,
			max ?? 0
		);
		const precision = Math.min(
			Math.max( requiredPrecision, 0 ),
			MAX_TO_FIXED_PRECISION
		);
		const nextValue =
			requiredPrecision > MAX_TO_FIXED_PRECISION
				? String( next )
				: String( Number( next.toFixed( precision ) ) );

		const canonicalNext = toCanonicalNumberValue( nextValue, integerOnly );
		if ( canonicalNext === null ) {
			showInvalidValueError();
			return;
		}

		const canonicalNextValue = String( canonicalNext );
		setDraftValue( canonicalNextValue );
		setError( undefined );
		inputRef.current?.setCustomValidity( '' );
		onChange( canonicalNext );
		// Focus stays on the spin button while the input updates, so the
		// new value must be announced to assistive technology explicitly.
		speak( canonicalNextValue );
	};

	const incrementDisabled =
		disabled ||
		( typeof max !== 'undefined' && current !== null && current >= max );
	const decrementDisabled =
		disabled ||
		( typeof min !== 'undefined' && current !== null && current <= min );

	const incrementLabel = label
		? sprintf(
				// translators: %s: the label of the number field being stepped.
				__( 'Increment %s', 'woocommerce' ),
				label
		  )
		: __( 'Increment', 'woocommerce' );
	const decrementLabel = label
		? sprintf(
				// translators: %s: the label of the number field being stepped.
				__( 'Decrement %s', 'woocommerce' ),
				label
		  )
		: __( 'Decrement', 'woocommerce' );

	return (
		<BaseControl
			className="wc-settings-ui__control"
			id={ id }
			label={ label }
			help={ help }
			__nextHasNoMarginBottom
		>
			<div className="wc-settings-ui__number-control">
				{ /* Schema-provided attributes are spread first so they can
				     never override the controlled props below. */ }
				<input
					{ ...inputAttributes }
					ref={ inputRef }
					className="wc-settings-ui__number-control-input"
					type="number"
					id={ id }
					value={ draftValue }
					placeholder={ placeholder }
					disabled={ disabled }
					aria-describedby={ describedBy || undefined }
					aria-invalid={ error ? true : undefined }
					onChange={ ( event ) => {
						setDraftValue( event.currentTarget.value );
						setError( undefined );
						event.currentTarget.setCustomValidity( '' );
					} }
					onBlur={ commitDraft }
				/>
				<div className="wc-settings-ui__number-control-spin-buttons">
					<Button
						size="small"
						icon={ plusIcon }
						label={ incrementLabel }
						disabled={ incrementDisabled }
						accessibleWhenDisabled
						onClick={ () => stepBy( 1 ) }
					/>
					<Button
						size="small"
						icon={ minusIcon }
						label={ decrementLabel }
						disabled={ decrementDisabled }
						accessibleWhenDisabled
						onClick={ () => stepBy( -1 ) }
					/>
				</div>
			</div>
			{ error ? (
				<p
					id={ errorId }
					className="components-base-control__help"
					role="alert"
				>
					{ error }
				</p>
			) : null }
		</BaseControl>
	);
};

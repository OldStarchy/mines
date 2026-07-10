import { Select } from '@base-ui/react/select';

/** A small styled wrapper over Base UI Select for label/value pairs. */
export default function ThemedSelect<Value extends string>({
	value,
	onValueChange,
	items,
	ariaLabel,
}: {
	value: Value;
	onValueChange: (value: Value) => void;
	items: Record<Value, string>;
	ariaLabel: string;
}) {
	return (
		<Select.Root
			value={value}
			onValueChange={(next) => onValueChange(next as Value)}
			items={items}
		>
			<Select.Trigger className="select-trigger" aria-label={ariaLabel}>
				<Select.Value />
				<Select.Icon className="select-icon">▾</Select.Icon>
			</Select.Trigger>
			<Select.Portal>
				<Select.Positioner className="select-positioner" sideOffset={4}>
					<Select.Popup className="select-popup">
						{(Object.entries(items) as [Value, string][]).map(
							([itemValue, label]) => (
								<Select.Item
									key={itemValue}
									value={itemValue}
									className="select-item"
								>
									<Select.ItemIndicator className="select-item-indicator">
										✓
									</Select.ItemIndicator>
									<Select.ItemText>{label}</Select.ItemText>
								</Select.Item>
							),
						)}
					</Select.Popup>
				</Select.Positioner>
			</Select.Portal>
		</Select.Root>
	);
}

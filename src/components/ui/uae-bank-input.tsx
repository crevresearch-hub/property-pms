"use client"

import { forwardRef } from "react"

// UAE banks — CBUAE-licensed local banks + major international branches.
// Kept in display order (alphabetical). Feel free to extend.
export const UAE_BANKS: string[] = [
  // Local / UAE-incorporated
  "Abu Dhabi Commercial Bank (ADCB)",
  "Abu Dhabi Islamic Bank (ADIB)",
  "Ajman Bank",
  "Al Hilal Bank",
  "Al Maryah Community Bank (Mbank)",
  "Arab Bank for Investment & Foreign Trade (Al Masraf)",
  "Bank of Sharjah",
  "Commercial Bank International (CBI)",
  "Commercial Bank of Dubai (CBD)",
  "Dubai Islamic Bank (DIB)",
  "Emirates Investment Bank",
  "Emirates Islamic Bank",
  "Emirates NBD",
  "First Abu Dhabi Bank (FAB)",
  "Invest Bank",
  "Liv (by Emirates NBD)",
  "Mashreq Bank",
  "Mashreq Neo",
  "National Bank of Fujairah (NBF)",
  "National Bank of Ras Al Khaimah (RAKBANK)",
  "National Bank of Umm Al Quwain (NBQ)",
  "Sharjah Islamic Bank (SIB)",
  "United Arab Bank (UAB)",
  "Wio Bank",
  "Zand Bank",

  // International branches operating in UAE
  "Arab African International Bank",
  "Arab Bank",
  "Bank Melli Iran",
  "Bank of Baroda",
  "Bank of China",
  "Bank Saderat Iran",
  "Barclays Bank",
  "BNP Paribas",
  "BOK International",
  "Citibank",
  "Credit Agricole",
  "Deutsche Bank",
  "Doha Bank",
  "El Nilein Bank",
  "Habib Bank AG Zurich",
  "HSBC Bank Middle East",
  "Industrial & Commercial Bank of China (ICBC)",
  "JP Morgan Chase",
  "KEB Hana Bank",
  "Lloyds Bank",
  "MCB Bank",
  "Mitsubishi UFJ Financial Group (MUFG)",
  "National Bank of Bahrain (NBB)",
  "National Bank of Kuwait (NBK)",
  "Samba Financial Group",
  "Societe Generale",
  "Standard Chartered",
  "Standard Chartered Saadiq",
  "State Bank of India (SBI)",
  "United Bank Limited (UBL)",
]

interface Props {
  value: string
  onChange: (v: string) => void
  className?: string
  placeholder?: string
  disabled?: boolean
  id?: string
  name?: string
}

// Simple bank picker: native HTML <input list> + <datalist>.
// Users get free-text typing with autocomplete suggestions —
// they can also type anything (e.g. a branch name) since we don't lock to the list.
export const UaeBankInput = forwardRef<HTMLInputElement, Props>(function UaeBankInput(
  { value, onChange, className, placeholder = "Search bank…", disabled, id, name },
  ref
) {
  const listId = "uae-banks-list"
  return (
    <>
      <input
        ref={ref}
        id={id}
        name={name}
        list={listId}
        type="text"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={className}
      />
      <datalist id={listId}>
        {UAE_BANKS.map((b) => (
          <option key={b} value={b} />
        ))}
      </datalist>
    </>
  )
})

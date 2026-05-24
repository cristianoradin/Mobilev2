//go:build !windows

package setup

// enableWindowsANSI é no-op em sistemas não-Windows (ANSI já funciona nativamente).
func enableWindowsANSI() {}

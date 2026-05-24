//go:build windows

package setup

import (
	"syscall"
	"unsafe"
)

// enableWindowsANSI habilita o modo ENABLE_VIRTUAL_TERMINAL_PROCESSING no
// console do Windows 10+, que permite sequências de escape ANSI para cores.
// Em versões antigas do Windows (< 10), as cores são silenciosamente ignoradas.
func enableWindowsANSI() {
	kernel32 := syscall.NewLazyDLL("kernel32.dll")
	setConsoleMode := kernel32.NewProc("SetConsoleMode")
	getConsoleMode := kernel32.NewProc("GetConsoleMode")

	handle, err := syscall.GetStdHandle(syscall.STD_OUTPUT_HANDLE)
	if err != nil {
		return
	}

	var mode uint32
	getConsoleMode.Call(uintptr(handle), uintptr(unsafe.Pointer(&mode)))
	// ENABLE_VIRTUAL_TERMINAL_PROCESSING = 0x0004
	setConsoleMode.Call(uintptr(handle), uintptr(mode|0x0004))
}

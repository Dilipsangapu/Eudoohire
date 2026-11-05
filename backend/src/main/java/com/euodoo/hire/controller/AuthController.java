package com.euodoo.hire.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;

/**
 * View controller for authentication and registration pages.
 */
@Controller
public class AuthController {

    /**
     * Login page view mapping.
     * Spring Security processes POST /auth/login.
     */
    @GetMapping("/auth/login")
    public String loginPage() {
        return "redirect:/login";
    }

    /**
     * Fallback for POST /login to prevent 405 Method Not Allowed if a client submits to /login.
     */
    @PostMapping("/login")
    public String loginPostFallback() {
        return "redirect:/login";
    }

    /**
     * Registration choice page.
     */
    @GetMapping("/auth/register")
    public String registerPage() {
        return "redirect:/register";
    }
}

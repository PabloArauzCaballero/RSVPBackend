package com.rsvp.identity.interfaces.http;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.UUID;
import java.util.regex.Pattern;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/** Accepts Kong's X-Correlation-Id (or creates one), echoes it and puts it in the log context. */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class CorrelationIdFilter extends OncePerRequestFilter {
    public static final String HEADER = "X-Correlation-Id";
    private static final String ATTRIBUTE = CorrelationIdFilter.class.getName();
    private static final String MDC_KEY = "correlationId";
    /** Kong's uuid#counter generator appends "#n"; anything else unusual is replaced. */
    private static final Pattern SAFE = Pattern.compile("^[A-Za-z0-9#:-]{1,100}$");

    static String current(HttpServletRequest request) {
        var value = request.getAttribute(ATTRIBUTE);
        return value == null ? UUID.randomUUID().toString() : value.toString();
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain) throws ServletException, IOException {
        var incoming = request.getHeader(HEADER);
        var id = incoming != null && SAFE.matcher(incoming).matches() ? incoming : UUID.randomUUID().toString();
        request.setAttribute(ATTRIBUTE, id);
        response.setHeader(HEADER, id);
        MDC.put(MDC_KEY, id);
        try { chain.doFilter(request, response); }
        finally { MDC.remove(MDC_KEY); }
    }
}
